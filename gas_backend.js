/**
 * デジタル名刺 - Google Apps Script バックエンド v4.1
 *   - v4.1: PROリンク上限 5→8
 *
 * v4.0 の変更点:
 *   - ルーティングテーブル化: 全アクションに認証種別(none/session/admin)と
 *     書き込みフラグを宣言。認証チェックの書き忘れが構造的に起きない
 *   - 書き込み系アクションは LockService で直列化（同時保存の競合防止）
 *   - usersシート等の読み取りをリクエスト内キャッシュ化（全読み17回→1〜2回）
 *   - ★ PINをハッシュ保存（sha256・ユーザー名ソルト付き）。平文PINは
 *     initSheets() 実行時または認証成功時に自動移行。
 *     これに伴い get_my_pin / admin_get_pin / admin_get_all_pins は廃止
 *     （PINは誰にも表示されない。忘れた場合は admin_reset_pin → 再設定）
 *   - エラーレスポンスに code を追加（success/error は従来互換）
 *
 * 【再デプロイ手順】
 * 1. スプレッドシート → 拡張機能 → Apps Script → このコードで全置き換え
 * 2. initSheets() を1回手動実行（PINハッシュ移行を含む）
 * 3. デプロイ → デプロイを管理 → 編集 → 新バージョン → デプロイ
 * ※ index.html v5.12 とセットで反映すること
 */

// ── 定数 ──────────────────────────────────────────────────────────
const SHEET_USERS         = "users";
const SHEET_CONFIG        = "config";
const SHEET_LICENSE       = "licenses";
const SHEET_SESSIONS      = "sessions";
const SHEET_REGISTRATIONS = "registrations";
const SESSION_TTL_MS      = 30 * 24 * 60 * 60 * 1000; // 30日（端末記憶用）
const ADMIN_EMAIL         = "furetomojapan@gmail.com";
const SITE_URL            = "https://furetomojapan.github.io/meishi/";

const FREE_TAG_LIMIT  = 1;
const PRO_TAG_LIMIT   = 5;
const TAG_MAX_LEN     = 20;
const TAG_COOLDOWN_MS = 24 * 60 * 60 * 1000; // タグ変更は24時間に1回（全削除は対象外）

const FREE_LINK_LIMIT = 1;
const PRO_LINK_LIMIT  = 8; // v4.1: 5→8（プラン差別化）

const PIN_MAX_ATTEMPTS = 5;        // 連続失敗の上限
const PIN_LOCK_SECONDS = 15 * 60;  // ロックアウト時間（15分）

// ── リクエスト内キャッシュ（GASは実行間でグローバルが残るため毎回リセット）──
let _cache = {};
function resetRequestCache() { _cache = {}; }
function invalidateUsersCache() { delete _cache.usersTable; }
function invalidateConfigCache() { delete _cache.config; }

// ── HTTPエントリ ───────────────────────────────────────────────────
function doGet(e) {
  resetRequestCache();
  let result;
  try {
    const action = e.parameter.action || "get_user";
    if (action === "get_user") {
      const id = String(e.parameter.id || "").trim();
      if (!id) {
        result = { error: "id required", code: "BAD_REQUEST" };
      } else {
        const u = getUserPublic(id); // name / publicId / tagPublicId で検索
        result = u ? { name: u.name, user: u.data } : { error: "not found", code: "NOT_FOUND" };
      }
    } else {
      result = { error: "unknown action", code: "UNKNOWN_ACTION" };
    }
  } catch (err) {
    result = { error: err.message, code: "INTERNAL" };
  }
  return jsonResponse(result);
}

function doPost(e) {
  resetRequestCache();
  let p;
  try { p = JSON.parse(e.postData.contents); }
  catch { return jsonResponse({ error: "invalid JSON", code: "BAD_REQUEST" }); }

  const route = ROUTES[p.action];
  if (!route) return jsonResponse({ error: "unknown action", code: "UNKNOWN_ACTION" });

  try {
    // ── 認証（ルート宣言に基づき一元処理）──
    if (route.auth === "session") {
      if (!validateSession(p.name, p.token))
        return jsonResponse({ success: false, error: "セッション無効または期限切れ", code: "SESSION_INVALID" });
    } else if (route.auth === "admin") {
      if (!checkAdminPass(p.adminPass))
        return jsonResponse({ success: false, error: "認証失敗", code: "AUTH_FAILED" });
    }
    // ── 書き込み系はロックで直列化 ──
    if (route.write) {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(20 * 1000))
        return jsonResponse({ success: false, error: "混み合っています。もう一度お試しください", code: "BUSY" });
      try { return jsonResponse(route.handler(p)); }
      finally { lock.releaseLock(); }
    }
    return jsonResponse(route.handler(p));
  } catch (err) {
    return jsonResponse({ error: err.message, code: "INTERNAL" });
  }
}

// ── ルーティングテーブル ──────────────────────────────────────────
// auth: "none"=認証不要 / "session"=PINセッション必須 / "admin"=管理者必須
// write: true なら LockService で直列化
const ROUTES = {

  // ―― 利用者（認証なし）――
  verify_pin: { auth: "none", write: true, handler: (p) => {
    if (isPinLocked(p.name))
      return { success: false, error: "試行回数が上限に達しました。15分ほど待ってからもう一度お試しください", code: "PIN_LOCKED" };
    if (!checkPin(p.name, p.pin)) {
      const left = recordPinFailure(p.name);
      const msg = left > 0
        ? "PINが違います（あと" + left + "回失敗するとロックされます）"
        : "試行回数が上限に達しました。15分ほど待ってからもう一度お試しください";
      return { success: false, error: msg, code: "PIN_INVALID" };
    }
    clearPinFailures(p.name);
    return { success: true, token: createSession(p.name) };
  }},

  set_initial_pin: { auth: "none", write: true, handler: (p) => {
    // PIN未設定ユーザーの初回設定専用
    if (!p.name || !p.pin || !/^\d{6}$/.test(String(p.pin)))
      return { success: false, error: "6桁の数字で入力してください", code: "VALIDATION" };
    if (!userExists(p.name))
      return { success: false, error: "ユーザーが見つかりません。ページを再読み込みしてください", code: "NOT_FOUND" };
    if (getUserPinCell(p.name))
      return { success: false, error: "PINは既に設定されています", code: "PIN_EXISTS" };
    setUserPin(p.name, String(p.pin));
    return { success: true, token: createSession(p.name) };
  }},

  verify_admin: { auth: "none", write: false, handler: (p) => {
    const ok = checkAdminPass(p.password);
    const mustChange = ok && String(p.password) === "admin123"; // 初期パスは強制変更
    return { success: ok, mustChange };
  }},

  save_admin_pass: { auth: "none", write: true, handler: (p) => {
    // 現在のパスワードで認証してから変更（ルート認証は使わない特殊ケース）
    if (!checkAdminPass(p.currentPass))
      return { success: false, error: "現在のパスワードが違います", code: "AUTH_FAILED" };
    const np = String(p.password || "");
    if (np.length < 8)   return { success: false, error: "パスワードは8文字以上にしてください", code: "VALIDATION" };
    if (np === "admin123") return { success: false, error: "初期パスワードは使用できません", code: "VALIDATION" };
    setConfig("adminPass", "sha256:" + sha256Hex(np));
    return { success: true };
  }},

  self_register: { auth: "none", write: true, handler: (p) => selfRegister(p) },

  // ―― 利用者（PINセッション必須）――
  save_user_profile: { auth: "session", write: true, handler: (p) => {
    // plan・plusG・pinは変更不可。リンク上限はサーバー側プランで強制
    const linkLimit = getUserPlan(p.name) === "pro" ? PRO_LINK_LIMIT : FREE_LINK_LIMIT;
    const links = (Array.isArray(p.links) ? p.links : []).slice(0, linkLimit);
    if (!saveUserProfile(p.name, p.displayName, links, p.profile))
      return { success: false, error: "ユーザーが見つかりません", code: "NOT_FOUND" };
    return { success: true };
  }},

  change_pin: { auth: "session", write: true, handler: (p) => {
    if (!p.newPin || !/^\d{6}$/.test(String(p.newPin)))
      return { success: false, error: "6桁の数字で入力してください", code: "VALIDATION" };
    setUserPin(p.name, String(p.newPin));
    return { success: true };
  }},

  save_tags: { auth: "session", write: true, handler: (p) => {
    const plan  = getUserPlan(p.name);
    const limit = plan === "pro" ? PRO_TAG_LIMIT : FREE_TAG_LIMIT;
    const r = sanitizeTags(p.tags, limit);
    if (r.error) return { success: false, error: r.error, code: "VALIDATION" };
    const nowMs = Date.now();
    if (r.tags.length > 0) { // 24時間クールダウン（全削除はいつでも可能）
      const last = getTagsUpdatedAt(p.name);
      if (last && (nowMs - last) < TAG_COOLDOWN_MS) {
        const hoursLeft = Math.ceil((TAG_COOLDOWN_MS - (nowMs - last)) / (60 * 60 * 1000));
        return { success: false, code: "TAG_COOLDOWN",
          error: "タグは保存後24時間変更できません。次に変更できるのは約" + hoursLeft + "時間後です（削除はいつでも可能）",
          nextChangeAt: last + TAG_COOLDOWN_MS };
      }
    }
    if (!setUserTags(p.name, r.tags))
      return { success: false, error: "ユーザーが見つかりません", code: "NOT_FOUND" };
    if (r.tags.length > 0) setTagsUpdatedAt(p.name, nowMs);
    const last2 = getTagsUpdatedAt(p.name);
    const next  = last2 ? last2 + TAG_COOLDOWN_MS : 0;
    return { success: true, tags: r.tags, nextChangeAt: next > Date.now() ? next : 0,
      counts: getMyTagCounts(p.name) };
  }},

  get_my_tags: { auth: "session", write: false, handler: (p) => {
    const lastUpd = getTagsUpdatedAt(p.name);
    const nextChg = lastUpd ? lastUpd + TAG_COOLDOWN_MS : 0;
    return { success: true, tags: getUserTags(p.name),
      nextChangeAt: nextChg > Date.now() ? nextChg : 0,
      counts: getMyTagCounts(p.name) };
  }},

  get_users_by_tag: { auth: "session", write: false, handler: (p) => {
    const tag = normalizeTag(p.tag);
    if (!tag) return { success: false, error: "タグを指定してください", code: "VALIDATION" };
    const myTags = activeTags(getUserTags(p.name), getUserPlan(p.name));
    if (!myTags.includes(tag))
      return { success: false, error: "このタグはあなたに設定されていません", code: "FORBIDDEN" };
    return { success: true, tag, users: findUsersByTag(tag, p.name) };
  }},

  // ―― 管理者 ――
  admin_get_all: { auth: "admin", write: false, handler: () =>
    ({ success: true, users: getAllUsersAdmin(), licenses: getLicenses() }) },

  admin_get_tags: { auth: "admin", write: false, handler: () => {
    const t = getUsersTable();
    const all = {};
    if (t.colTags >= 0) {
      for (let i = 1; i < t.rows.length; i++) {
        if (t.rows[i][0]) all[t.rows[i][0]] = parseJson(t.rows[i][t.colTags], []);
      }
    }
    return { success: true, tags: all };
  }},

  admin_save_tags: { auth: "admin", write: true, handler: (p) => {
    const r = sanitizeTags(p.tags, PRO_TAG_LIMIT); // 管理者は5つまで保存可・制限対象外
    if (r.error) return { success: false, error: r.error, code: "VALIDATION" };
    if (!setUserTags(p.name, r.tags))
      return { success: false, error: "ユーザーが見つかりません", code: "NOT_FOUND" };
    return { success: true, tags: r.tags };
  }},

  admin_create_user: { auth: "admin", write: true, handler: (p) => {
    adminCreateUser(p.name); // PINは作成しない（ユーザーが初回設定）
    return { success: true };
  }},

  admin_save_user: { auth: "admin", write: true, handler: (p) => {
    adminSaveUser(p.name, p.displayName, p.licenseKey, p.links, p.plan, p.profile, p.pin, p.plusG);
    return { success: true };
  }},

  admin_toggle_plan:  { auth: "admin", write: true, handler: (p) => ({ success: true, plan: adminTogglePlan(p.name) }) },
  admin_toggle_plusg: { auth: "admin", write: true, handler: (p) => ({ success: true, plusG: adminTogglePlusG(p.name) }) },
  admin_delete_user:  { auth: "admin", write: true, handler: (p) => { deleteUser(p.name); return { success: true }; } },

  admin_set_pin: { auth: "admin", write: true, handler: (p) => {
    if (!p.pin || !/^\d{6}$/.test(String(p.pin)))
      return { success: false, error: "6桁の数字で入力してください", code: "VALIDATION" };
    setUserPin(p.name, String(p.pin));
    clearPinFailures(p.name); // ロックも解除
    return { success: true };
  }},

  admin_reset_pin: { auth: "admin", write: true, handler: (p) => {
    setUserPin(p.name, ""); // クリア → ユーザーが次回アクセスで再設定
    clearPinFailures(p.name);
    return { success: true };
  }},

  save_licenses: { auth: "admin", write: true, handler: (p) => { saveLicenses(p.licenses); return { success: true }; } }

  // ※ v4.0: get_my_pin / admin_get_pin / admin_get_all_pins は廃止（PINハッシュ化のため表示不可）
};

// ── シート初期化 ──────────────────────────────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let us = ss.getSheetByName(SHEET_USERS);
  if (!us) {
    us = ss.insertSheet(SHEET_USERS);
    us.appendRow(["name","displayName","licenseKey","links","plan","profile","pin","plusG","publicId","tags","tagsUpdatedAt","tagPublicId"]);
    us.getRange(1,1,1,12).setFontWeight("bold");
  } else {
    let header = us.getRange(1, 1, 1, us.getLastColumn()).getValues()[0];
    ["pin","plusG","publicId","tags","tagsUpdatedAt","tagPublicId"].forEach(col => {
      header = us.getRange(1, 1, 1, us.getLastColumn()).getValues()[0];
      if (!header.includes(col)) us.getRange(1, header.length + 1).setValue(col);
    });
  }
  invalidateUsersCache();

  migratePublicIds();
  migrateTagPublicIds();
  migratePinHashes(); // ★ v4.0: 平文PINをハッシュへ一括移行

  let cs = ss.getSheetByName(SHEET_CONFIG);
  if (!cs) {
    cs = ss.insertSheet(SHEET_CONFIG);
    cs.appendRow(["key","value"]);
    cs.appendRow(["adminPass", "sha256:" + sha256Hex("admin123")]); // 初回ログインで強制変更
    cs.getRange(1,1,1,2).setFontWeight("bold");
  }

  let ls = ss.getSheetByName(SHEET_LICENSE);
  if (!ls) {
    ls = ss.insertSheet(SHEET_LICENSE);
    ls.appendRow(["licenseKey","plan","note","issuedAt"]);
    ls.getRange(1,1,1,4).setFontWeight("bold");
  }

  let ses = ss.getSheetByName(SHEET_SESSIONS);
  if (!ses) {
    ses = ss.insertSheet(SHEET_SESSIONS);
    ses.appendRow(["name","token","expiresAt"]);
    ses.getRange(1,1,1,3).setFontWeight("bold");
  }

  let reg = ss.getSheetByName(SHEET_REGISTRATIONS);
  if (!reg) {
    reg = ss.insertSheet(SHEET_REGISTRATIONS);
    reg.appendRow(["emailNormalized","emailOriginal","userId","registeredAt"]);
    reg.getRange(1,1,1,4).setFontWeight("bold");
  }
}

// ── ユーザーテーブル（リクエスト内キャッシュ付き）──────────────────
function getUsersTable() {
  if (_cache.usersTable) return _cache.usersTable;
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows   = sheet.getDataRange().getValues();
  const header = rows[0] || [];
  _cache.usersTable = {
    sheet, rows,
    colPublicId:    header.indexOf("publicId"),
    colTags:        header.indexOf("tags"),
    colTagsUpdated: header.indexOf("tagsUpdatedAt"),
    colTagPublicId: header.indexOf("tagPublicId")
  };
  return _cache.usersTable;
}

function findUserRow(name) { // 1-based行番号と行データ。なければnull
  const t = getUsersTable();
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) return { idx: i + 1, row: t.rows[i], t };
  }
  return null;
}

// ── 行 → 公開用ユーザーデータ（PIN・licenseKey・tagsは送らない）──
function rowToPublicUser(row, t) {
  return {
    displayName: row[1] || "",
    links:       parseJson(row[3], []),
    plan:        row[4] || "free",
    profile:     parseJson(row[5], null),
    hasPinSet:   !!(row[6]),
    plusG:       row[7] === true || row[7] === "TRUE" || row[7] === 1 || row[7] === "1",
    publicId:    t.colPublicId >= 0 ? String(row[t.colPublicId] || "") : ""
  };
}

// ── 単一ユーザー取得（name / publicId / tagPublicId）───────────────
// tagPublicId（タグ仲間向け限定URL）の場合は電話・住所をタグ用の値に差し替え。
// 内部名・本来のpublicIdは返さない。
function getUserPublic(id) {
  const t = getUsersTable();
  for (let i = 1; i < t.rows.length; i++) {
    const row = t.rows[i];
    if (!row[0]) continue;
    const pubId = t.colPublicId >= 0 ? String(row[t.colPublicId] || "") : "";
    const tagId = t.colTagPublicId >= 0 ? String(row[t.colTagPublicId] || "") : "";
    if (row[0] === id || (pubId && pubId === id)) {
      return { name: row[0], data: rowToPublicUser(row, t) }; // フル表示
    }
    if (tagId && tagId === id) {
      const d = rowToPublicUser(row, t);
      if (d.profile) {
        d.profile = Object.assign({}, d.profile);
        d.profile.phone   = String(d.profile.tagPhone || "");   // 未入力=非表示
        d.profile.address = String(d.profile.tagAddress || "");
        delete d.profile.tagPhone;
        delete d.profile.tagAddress;
      }
      d.publicId = tagId;
      d._tagView = true;
      return { name: tagId, data: d };
    }
  }
  return null;
}

// ── 全件取得（管理者専用 — licenseKey含む）───────────────────────
function getAllUsersAdmin() {
  const t = getUsersTable();
  const result = {};
  for (let i = 1; i < t.rows.length; i++) {
    const row = t.rows[i];
    if (!row[0]) continue;
    const u = rowToPublicUser(row, t);
    u.licenseKey = row[2] || "";
    result[row[0]] = u;
  }
  return result;
}

// ── プロフィール保存（plan/plusG/pin変更不可）─────────────────────
function saveUserProfile(name, displayName, links, profile) {
  const f = findUserRow(name);
  if (!f) return false;
  f.t.sheet.getRange(f.idx, 2).setValue(displayName || "");
  f.t.sheet.getRange(f.idx, 4).setValue(JSON.stringify(links || []));
  f.t.sheet.getRange(f.idx, 6).setValue(profile ? JSON.stringify(profile) : "");
  invalidateUsersCache();
  return true;
}

// ── 管理者: ユーザー作成 ─────────────────────────────────────────
function adminCreateUser(name) {
  const t = getUsersTable();
  if (findUserRow(name)) return; // 既存
  const existing = t.colPublicId >= 0
    ? new Set(t.rows.slice(1).map(r => String(r[t.colPublicId] || "")).filter(Boolean))
    : new Set();
  t.sheet.appendRow([name, "", "", "[]", "free", "", "", false, generatePublicId(existing), "[]"]);
  invalidateUsersCache();
  ensureTagPublicId(name);
}

// ── 管理者: フル保存 ─────────────────────────────────────────────
function adminSaveUser(name, displayName, licenseKey, links, plan, profile, pin, plusG) {
  const linksJson   = JSON.stringify(links || []);
  const profileJson = profile ? JSON.stringify(profile) : "";
  const planVal     = plan || "free";
  const plusGVal    = plusG === true || plusG === "true" || plusG === 1;
  const f = findUserRow(name);
  if (f) {
    const currentPin = String(f.row[6] || "");
    // pinが明示的に渡された場合のみ更新（ハッシュ化して保存）
    const pinVal = pin !== undefined && pin !== null && String(pin) !== ""
      ? hashPin(name, String(pin))
      : (pin === "" ? "" : currentPin);
    f.t.sheet.getRange(f.idx, 1, 1, 8).setValues([[
      name, displayName || "", licenseKey || "", linksJson, planVal, profileJson, pinVal, plusGVal
    ]]);
    invalidateUsersCache();
    return;
  }
  // 新規（PINは空欄 — ユーザーが初回設定）
  const t = getUsersTable();
  const existing = t.colPublicId >= 0
    ? new Set(t.rows.slice(1).map(r => String(r[t.colPublicId] || "")).filter(Boolean))
    : new Set();
  t.sheet.appendRow([name, displayName||"", licenseKey||"", linksJson, planVal, profileJson,
    pin ? hashPin(name, String(pin)) : "", plusGVal, generatePublicId(existing), "[]"]);
  invalidateUsersCache();
  ensureTagPublicId(name);
}

function adminTogglePlan(name) {
  const f = findUserRow(name);
  if (!f) return "free";
  const newPlan = f.row[4] === "pro" ? "free" : "pro";
  f.t.sheet.getRange(f.idx, 5).setValue(newPlan);
  invalidateUsersCache();
  return newPlan;
}

function adminTogglePlusG(name) {
  const f = findUserRow(name);
  if (!f) return false;
  const cur = f.row[7] === true || f.row[7] === "TRUE" || f.row[7] === 1;
  f.t.sheet.getRange(f.idx, 8).setValue(!cur);
  invalidateUsersCache();
  return !cur;
}

function deleteUser(name) {
  const f = findUserRow(name);
  if (f) { f.t.sheet.deleteRow(f.idx); invalidateUsersCache(); }
}

function userExists(name) { return !!name && !!findUserRow(name); }

// ── PIN（★ v4.0: ハッシュ保存）──────────────────────────────────
function hashPin(name, pin) {
  // ユーザー名をソルトに（同じPINでも別ハッシュになる）
  return "sha256:" + sha256Hex(String(name) + ":" + String(pin));
}

function getUserPinCell(name) { // セル生値（ハッシュ or 旧平文 or 空）
  const f = findUserRow(name);
  return f ? String(f.row[6] || "") : "";
}

function setUserPin(name, pin) { // 空文字=リセット。それ以外はハッシュ化して保存
  const f = findUserRow(name);
  if (!f) return;
  f.t.sheet.getRange(f.idx, 7).setValue(pin ? hashPin(name, pin) : "");
  invalidateUsersCache();
}

function checkPin(name, pin) {
  if (!name || !pin) return false;
  const stored = getUserPinCell(name);
  if (!stored) return false; // 未設定は拒否
  if (stored.indexOf("sha256:") === 0) return hashPin(name, String(pin)) === stored;
  // 旧形式（平文）— 一致したらハッシュへ自動移行
  if (String(stored) === String(pin)) { setUserPin(name, String(pin)); return true; }
  return false;
}

// 平文PINを一括でハッシュへ移行（initSheetsから呼ばれる）
function migratePinHashes() {
  const t = getUsersTable();
  for (let i = 1; i < t.rows.length; i++) {
    const name = t.rows[i][0];
    const cell = String(t.rows[i][6] || "");
    if (name && cell && cell.indexOf("sha256:") !== 0) {
      t.sheet.getRange(i + 1, 7).setValue(hashPin(name, cell));
    }
  }
  invalidateUsersCache();
}

// ── PIN総当たり対策（CacheService）────────────────────────────────
function isPinLocked(name) {
  if (!name) return false;
  return !!CacheService.getScriptCache().get("pinlock_" + name);
}
function recordPinFailure(name) {
  if (!name) return 0;
  const cache = CacheService.getScriptCache();
  const key = "pinfail_" + name;
  const n = parseInt(cache.get(key) || "0", 10) + 1;
  cache.put(key, String(n), PIN_LOCK_SECONDS);
  if (n >= PIN_MAX_ATTEMPTS) {
    cache.put("pinlock_" + name, "1", PIN_LOCK_SECONDS);
    cache.remove(key);
    return 0;
  }
  return PIN_MAX_ATTEMPTS - n;
}
function clearPinFailures(name) {
  if (!name) return;
  const cache = CacheService.getScriptCache();
  cache.remove("pinfail_" + name);
  cache.remove("pinlock_" + name);
}

// ── セッション ────────────────────────────────────────────────────
function generateToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
}

function secureRandomBytes(n) {
  let out = [];
  while (out.length < n) {
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Utilities.getUuid() + Date.now()
    );
    for (let i = 0; i < digest.length; i++) out.push((digest[i] + 256) % 256);
  }
  return out.slice(0, n);
}

function createSession(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SESSIONS);
  cleanExpiredSessions(sheet);
  const token = generateToken();
  sheet.appendRow([name, token, new Date(Date.now() + SESSION_TTL_MS).toISOString()]);
  return token;
}

function validateSession(name, token) {
  if (!name || !token) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SESSIONS);
  const rows  = sheet.getDataRange().getValues();
  const now   = Date.now();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== name || rows[i][1] !== token) continue;
    if (now < new Date(rows[i][2]).getTime()) return true;
    sheet.deleteRow(i + 1); // 期限切れ
    return false;
  }
  return false;
}

function cleanExpiredSessions(sheet) {
  const rows = sheet.getDataRange().getValues();
  const now  = Date.now();
  for (let i = rows.length - 1; i >= 1; i--) {
    try { if (new Date(rows[i][2]).getTime() < now) sheet.deleteRow(i + 1); } catch {}
  }
}

// ── 管理者認証（SHA-256ハッシュ・平文は自動移行）──────────────────
function sha256Hex(str) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str), Utilities.Charset.UTF_8);
  return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function checkAdminPass(password) {
  if (!password) return false;
  const stored = getConfig()["adminPass"];
  if (!stored) return false;
  const s = String(stored);
  if (s.indexOf("sha256:") === 0) return sha256Hex(password) === s.slice(7);
  if (String(password) === s) { // 旧平文 → 自動移行
    setConfig("adminPass", "sha256:" + sha256Hex(password));
    return true;
  }
  return false;
}

// ── コンフィグ（リクエスト内キャッシュ付き）────────────────────────
function getConfig() {
  if (_cache.config) return _cache.config;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  const rows  = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) result[rows[i][0]] = rows[i][1];
  }
  _cache.config = result;
  return result;
}

function setConfig(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) { sheet.getRange(i+1, 2).setValue(value); invalidateConfigCache(); return; }
  }
  sheet.appendRow([key, value]);
  invalidateConfigCache();
}

// ── ライセンス ────────────────────────────────────────────────────
function getLicenses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LICENSE);
  const rows  = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const [key, plan, note, issuedAt] = rows[i];
    if (!key) continue;
    result[key] = { plan: plan||"pro", note: note||"", issuedAt: issuedAt||"" };
  }
  return result;
}

function saveLicenses(licenses) {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LICENSE);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow-1, 4).clearContent();
  Object.entries(licenses || {}).forEach(([key, val]) => {
    sheet.appendRow([key, val.plan||"pro", val.note||"", val.issuedAt||""]);
  });
}

// ── 自己登録 ──────────────────────────────────────────────────────
function selfRegister(p) {
  const email = (p.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { success: false, error: "正しいメールアドレスを入力してください", code: "VALIDATION" };

  const normalized = normalizeEmail(email);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regSheet = ss.getSheetByName(SHEET_REGISTRATIONS);
  const now = new Date();

  if (regSheet) { // 24h 重複チェック
    const regRows = regSheet.getDataRange().getValues();
    for (let i = 1; i < regRows.length; i++) {
      if (regRows[i][0] === normalized) {
        const registeredAt = new Date(regRows[i][3]);
        if ((now - registeredAt) < 24 * 60 * 60 * 1000) {
          const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - registeredAt)) / (60 * 60 * 1000));
          return { success: false, code: "DUPLICATE",
            error: `このメールアドレスは登録済みです。${hoursLeft}時間後に再度お試しください。` };
        }
      }
    }
  }

  // ユーザーID生成（@より前、重複時は3文字追加）
  const t = getUsersTable();
  const existingIds = new Set(t.rows.slice(1).map(r => r[0]));
  let baseId = email.split("@")[0].replace(/[^a-z0-9_\-]/gi, "").toLowerCase().slice(0, 20);
  if (!baseId) baseId = "user";
  let userId = baseId;
  let attempts = 0;
  while (existingIds.has(userId) && attempts < 10) {
    userId = baseId + generateShortId(3);
    attempts++;
  }
  if (existingIds.has(userId))
    return { success: false, error: "IDの生成に失敗しました。別のメールアドレスをお試しください。", code: "ID_CONFLICT" };

  adminCreateUser(userId);
  if (regSheet) regSheet.appendRow([normalized, email, userId, now.toISOString()]);

  const newPublicId = getPublicId(userId);
  const cardUrl = SITE_URL + "?id=" + (newPublicId || userId) + "&new=1";
  try {
    MailApp.sendEmail({
      to: email,
      subject: "【デジタル名刺】登録完了 — あなたの名刺URLをお届けします",
      body: "登録ありがとうございます！\n\nあなた専用の名刺URLはこちらです：\n" + cardUrl + "\n\n初回アクセス時に6桁のPINの設定が必要です。\n\n— XYZ Digital Card プロジェクト"
    });
  } catch (mailErr) { /* メール失敗でも登録は成功 */ }
  try {
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: "[名刺] 新規ユーザー登録: " + userId,
      body: "新規ユーザーが登録しました。\nID: " + userId + "\nメール: " + email + "\n登録日時: " + now.toISOString()
    });
  } catch (e2) { /* ignore */ }

  return { success: true, userId, cardUrl };
}

// ── ヘルパー ──────────────────────────────────────────────────────
function parseJson(str, fallback) {
  try { return JSON.parse(str || "null") ?? fallback; }
  catch { return fallback; }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeEmail(email) {
  const lower = email.toLowerCase().trim();
  const [local, domain] = lower.split("@");
  const cleanLocal = local.split("+")[0];
  if (["gmail.com", "googlemail.com"].includes(domain)) {
    return cleanLocal.replace(/\./g, "") + "@" + domain;
  }
  return cleanLocal + "@" + domain;
}

function generateShortId(n) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"; // 36種
  const bytes = secureRandomBytes(n * 2);
  let result = "";
  for (let i = 0; i < bytes.length && result.length < n; i++) {
    if (bytes[i] < 252) result += chars[bytes[i] % 36]; // 偏り除去
  }
  while (result.length < n) result += chars[secureRandomBytes(1)[0] % 36];
  return result;
}

// ── publicId / tagPublicId ────────────────────────────────────────
function generatePublicId(existingSet) {
  for (let a = 0; a < 20; a++) {
    const bytes = secureRandomBytes(18);
    let id = "zz";
    for (let i = 0; i < bytes.length && id.length < 11; i++) {
      if (bytes[i] < 250) id += String(bytes[i] % 10);
    }
    if (id.length < 11) continue;
    if (!existingSet || !existingSet.has(id)) return id;
  }
  return "zz" + Date.now();
}

function generateTagPublicId(existingSet) {
  for (let a = 0; a < 20; a++) {
    const bytes = secureRandomBytes(18);
    let id = "zt";
    for (let i = 0; i < bytes.length && id.length < 11; i++) {
      if (bytes[i] < 250) id += String(bytes[i] % 10);
    }
    if (id.length < 11) continue;
    if (!existingSet || !existingSet.has(id)) return id;
  }
  return "zt" + Date.now();
}

function migratePublicIds() {
  const t = getUsersTable();
  if (t.colPublicId < 0) return;
  const existing = new Set(t.rows.slice(1).map(r => String(r[t.colPublicId] || "")).filter(Boolean));
  for (let i = 1; i < t.rows.length; i++) {
    if (!t.rows[i][0]) continue;
    if (!t.rows[i][t.colPublicId]) {
      const id = generatePublicId(existing);
      existing.add(id);
      t.sheet.getRange(i + 1, t.colPublicId + 1).setValue(id);
    }
  }
  invalidateUsersCache();
}

function migrateTagPublicIds() {
  const t = getUsersTable();
  if (t.colTagPublicId < 0) return;
  const existing = new Set(t.rows.slice(1).map(r => String(r[t.colTagPublicId] || "")).filter(Boolean));
  for (let i = 1; i < t.rows.length; i++) {
    if (!t.rows[i][0]) continue;
    if (!t.rows[i][t.colTagPublicId]) {
      const id = generateTagPublicId(existing);
      existing.add(id);
      t.sheet.getRange(i + 1, t.colTagPublicId + 1).setValue(id);
    }
  }
  invalidateUsersCache();
}

function ensureTagPublicId(name) {
  const t = getUsersTable();
  if (t.colTagPublicId < 0) return;
  const existing = new Set(t.rows.slice(1).map(r => String(r[t.colTagPublicId] || "")).filter(Boolean));
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name && !t.rows[i][t.colTagPublicId]) {
      t.sheet.getRange(i + 1, t.colTagPublicId + 1).setValue(generateTagPublicId(existing));
      invalidateUsersCache();
      return;
    }
  }
}

function getPublicId(name) {
  const t = getUsersTable();
  if (t.colPublicId < 0) return "";
  const f = findUserRow(name);
  return f ? String(f.row[t.colPublicId] || "") : "";
}

// ── タグ ──────────────────────────────────────────────────────────
function normalizeTag(tag) {
  let s = String(tag || "");
  try { s = s.normalize("NFKC"); } catch(e) {}
  s = s.trim().toLowerCase().replace(/\s+/g, " ");
  return s;
}

function sanitizeTags(rawTags, limit) {
  if (!Array.isArray(rawTags)) return { error: "tags形式が不正です" };
  const seen = new Set();
  const out = [];
  for (const raw of rawTags) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    if (tag.length > TAG_MAX_LEN) return { error: "タグは" + TAG_MAX_LEN + "文字以内にしてください: " + tag };
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  if (out.length > limit) return { error: "タグは最大" + limit + "個までです" };
  return { tags: out };
}

function getUserTags(name) {
  const t = getUsersTable();
  if (t.colTags < 0) return [];
  const f = findUserRow(name);
  return f ? parseJson(f.row[t.colTags], []) : [];
}

function setUserTags(name, tags) {
  const t = getUsersTable();
  if (t.colTags < 0) throw new Error("tags列がありません。initSheets()を実行してください");
  const f = findUserRow(name);
  if (!f) return false;
  t.sheet.getRange(f.idx, t.colTags + 1).setValue(JSON.stringify(tags || []));
  invalidateUsersCache();
  return true;
}

function getTagsUpdatedAt(name) {
  const t = getUsersTable();
  if (t.colTagsUpdated < 0) return 0;
  const f = findUserRow(name);
  if (!f) return 0;
  const v = f.row[t.colTagsUpdated];
  if (!v) return 0;
  const ms = new Date(v).getTime();
  return isNaN(ms) ? 0 : ms;
}

function setTagsUpdatedAt(name, ms) {
  const t = getUsersTable();
  if (t.colTagsUpdated < 0) return;
  const f = findUserRow(name);
  if (!f) return;
  t.sheet.getRange(f.idx, t.colTagsUpdated + 1).setValue(new Date(ms).toISOString());
  invalidateUsersCache();
}

function getUserPlan(name) {
  const f = findUserRow(name);
  return f ? (f.row[4] || "free") : "free";
}

function activeTags(tags, plan) {
  const limit = plan === "pro" ? PRO_TAG_LIMIT : FREE_TAG_LIMIT;
  return (tags || []).slice(0, limit);
}

function getMyTagCounts(name) {
  const myActive = activeTags(getUserTags(name), getUserPlan(name));
  const counts = {};
  myActive.forEach(tag => { counts[tag] = findUsersByTag(tag, name).length; });
  return counts;
}

// 同じタグを持つユーザー一覧（displayName + タグ用限定ID のみ）
function findUsersByTag(tag, excludeName) {
  const t = getUsersTable();
  const result = [];
  if (t.colTags < 0 || t.colPublicId < 0) return result;
  for (let i = 1; i < t.rows.length; i++) {
    const row = t.rows[i];
    if (!row[0] || row[0] === excludeName) continue;
    const plan = row[4] || "free";
    const tags = activeTags(parseJson(row[t.colTags], []), plan);
    if (!tags.includes(tag)) continue;
    const tagId = t.colTagPublicId >= 0 ? String(row[t.colTagPublicId] || "") : "";
    result.push({
      displayName: row[1] || "",
      publicId: tagId || String(row[t.colPublicId] || "") // tagId未発行時のみ旧IDへフォールバック
    });
  }
  return result;
}
