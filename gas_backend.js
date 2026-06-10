/**
 * デジタル名刺 - Google Apps Script バックエンド v2.0
 * セキュリティ強化版:
 *   - PIN・adminPass はブラウザに送らない
 *   - verify_pin でサーバー側PIN検証 → セッショントークン発行
 *   - 全書き込みアクションに認証必須
 *
 * 【再デプロイ手順】
 * 1. スプレッドシート → 拡張機能 → Apps Script
 * 2. このコードで全体置き換え
 * 3. デプロイ → 既存のデプロイを管理 → 編集（鉛筆）→ バージョン: 新バージョン → デプロイ
 * 4. URLは変わらないのでindex.htmlの書き換え不要
 * 5. initSheets() を1回手動実行（sessionsシートを追加するため）
 */

const SHEET_USERS         = "users";
const SHEET_CONFIG        = "config";
const SHEET_LICENSE       = "licenses";
const SHEET_SESSIONS      = "sessions";
const SHEET_REGISTRATIONS = "registrations";
const SESSION_TTL_MS      = 30 * 24 * 60 * 60 * 1000; // 30日（端末記憶用）
const ADMIN_EMAIL         = "furetomojapan@gmail.com";
const SITE_URL            = "https://furetomojapan.github.io/meishi/";

// タグ機能
const FREE_TAG_LIMIT  = 1;
const PRO_TAG_LIMIT   = 5;
const TAG_MAX_LEN     = 20;
const TAG_COOLDOWN_MS = 24 * 60 * 60 * 1000; // タグ変更は24時間に1回（全削除は対象外）

// ── シート初期化 ──────────────────────────────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // users シート（pin・plusG・publicId・tags列を追加）
  let us = ss.getSheetByName(SHEET_USERS);
  if (!us) {
    us = ss.insertSheet(SHEET_USERS);
    us.appendRow(["name","displayName","licenseKey","links","plan","profile","pin","plusG","publicId","tags","tagsUpdatedAt"]);
    us.getRange(1,1,1,11).setFontWeight("bold");
  } else {
    // 既存シートに足りない列があれば追加
    let header = us.getRange(1, 1, 1, us.getLastColumn()).getValues()[0];
    ["pin","plusG","publicId","tags","tagsUpdatedAt"].forEach(col => {
      header = us.getRange(1, 1, 1, us.getLastColumn()).getValues()[0];
      if (!header.includes(col)) us.getRange(1, header.length + 1).setValue(col);
    });
  }

  // 既存ユーザーにpublicIdを発行（未設定の行のみ）
  migratePublicIds();

  // config シート
  let cs = ss.getSheetByName(SHEET_CONFIG);
  if (!cs) {
    cs = ss.insertSheet(SHEET_CONFIG);
    cs.appendRow(["key","value"]);
    cs.appendRow(["adminPass","admin123"]);
    cs.getRange(1,1,1,2).setFontWeight("bold");
  }

  // licenses シート
  let ls = ss.getSheetByName(SHEET_LICENSE);
  if (!ls) {
    ls = ss.insertSheet(SHEET_LICENSE);
    ls.appendRow(["licenseKey","plan","note","issuedAt"]);
    ls.appendRow(["MEISI-DEMO-PRO1-2026","pro","デモ用PROキー","2026-06-07"]);
    ls.getRange(1,1,1,4).setFontWeight("bold");
  }

  // sessions シート（新規）
  let ses = ss.getSheetByName(SHEET_SESSIONS);
  if (!ses) {
    ses = ss.insertSheet(SHEET_SESSIONS);
    ses.appendRow(["name","token","expiresAt"]);
    ses.getRange(1,1,1,3).setFontWeight("bold");
  }

  // registrations シート（自己登録追跡用）
  let reg = ss.getSheetByName(SHEET_REGISTRATIONS);
  if (!reg) {
    reg = ss.insertSheet(SHEET_REGISTRATIONS);
    reg.appendRow(["emailNormalized","emailOriginal","userId","registeredAt"]);
    reg.getRange(1,1,1,4).setFontWeight("bold");
  }
}

// ── GET ───────────────────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || "get_all";
  let result;
  try {
    if (action === "get_all") {
      result = {
        users:    getAllUsersPublic(), // ★ PIN除去
        config:   getConfigPublic(),  // ★ adminPass除去
        licenses: getLicenses()
      };
    } else if (action === "get_licenses") {
      result = getLicenses();
    } else {
      result = { error: "unknown action" };
    }
  } catch(err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

// ── POST ──────────────────────────────────────────────────────────
function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); }
  catch { return jsonResponse({ error: "invalid JSON" }); }

  try {
    switch(p.action) {

      // ── ユーザー操作（PINトークン必須）──────────────────────────

      case "verify_pin": {
        if (!checkPin(p.name, p.pin))
          return jsonResponse({ success: false, error: "PIN不正" });
        const token = createSession(p.name);
        return jsonResponse({ success: true, token });
      }

      case "save_user_profile": {
        // plan・plusG・pinは変更不可
        if (!validateSession(p.name, p.token))
          return jsonResponse({ success: false, error: "セッション無効または期限切れ" });
        if (!saveUserProfile(p.name, p.displayName, p.links, p.profile))
          return jsonResponse({ success: false, error: "ユーザーが見つかりません" });
        return jsonResponse({ success: true });
      }

      case "change_pin": {
        if (!validateSession(p.name, p.token))
          return jsonResponse({ success: false, error: "セッション無効または期限切れ" });
        if (!p.newPin || !/^\d{6}$/.test(String(p.newPin)))
          return jsonResponse({ success: false, error: "6桁の数字で入力してください" });
        setUserPin(p.name, String(p.newPin));
        return jsonResponse({ success: true });
      }

      case "check_pin_set": {
        // 認証不要 — PINの有無だけ返す（値は返さない）
        const hasPinSet = !!(getUserPin(p.name));
        return jsonResponse({ success: true, hasPinSet });
      }

      case "get_my_pin": {
        if (!validateSession(p.name, p.token))
          return jsonResponse({ success: false, error: "セッション無効または期限切れ" });
        const pin = getUserPin(p.name);
        return jsonResponse({ success: true, pin });
      }

      case "admin_reset_pin": {
        if (!checkAdminPass(p.adminPass)) return authError();
        setUserPin(p.name, ""); // PINをクリア
        return jsonResponse({ success: true });
      }

      case "set_initial_pin": {
        // PINが未設定のユーザーだけが使えるアクション（初回設定用）
        if (!p.name || !p.pin || !/^\d{6}$/.test(String(p.pin)))
          return jsonResponse({ success: false, error: "6桁の数字で入力してください" });
        if (!userExists(p.name))
          return jsonResponse({ success: false, error: "ユーザーが見つかりません。ページを再読み込みしてください" });
        const currentPin = getUserPin(p.name);
        if (currentPin) return jsonResponse({ success: false, error: "PINは既に設定されています" });
        setUserPin(p.name, String(p.pin));
        const token = createSession(p.name);
        return jsonResponse({ success: true, token });
      }

      // ── タグ操作（PINトークン必須）──────────────────────────────

      case "save_tags": {
        if (!validateSession(p.name, p.token))
          return jsonResponse({ success: false, error: "セッション無効または期限切れ" });
        const plan  = getUserPlan(p.name);
        const limit = plan === "pro" ? PRO_TAG_LIMIT : FREE_TAG_LIMIT;
        const r = sanitizeTags(p.tags, limit);
        if (r.error) return jsonResponse({ success: false, error: r.error });
        const nowMs = Date.now();
        // 24時間クールダウン（タグありの保存のみ。全削除はいつでも可能）
        if (r.tags.length > 0) {
          const last = getTagsUpdatedAt(p.name);
          if (last && (nowMs - last) < TAG_COOLDOWN_MS) {
            const hoursLeft = Math.ceil((TAG_COOLDOWN_MS - (nowMs - last)) / (60 * 60 * 1000));
            return jsonResponse({
              success: false,
              error: "タグは保存後24時間変更できません。次に変更できるのは約" + hoursLeft + "時間後です（削除はいつでも可能）",
              nextChangeAt: last + TAG_COOLDOWN_MS
            });
          }
        }
        if (!setUserTags(p.name, r.tags))
          return jsonResponse({ success: false, error: "ユーザーが見つかりません" });
        if (r.tags.length > 0) setTagsUpdatedAt(p.name, nowMs);
        const last2 = getTagsUpdatedAt(p.name);
        const next  = last2 ? last2 + TAG_COOLDOWN_MS : 0;
        return jsonResponse({ success: true, tags: r.tags, nextChangeAt: next > Date.now() ? next : 0 });
      }

      case "get_my_tags": {
        if (!validateSession(p.name, p.token))
          return jsonResponse({ success: false, error: "セッション無効または期限切れ" });
        const lastUpd = getTagsUpdatedAt(p.name);
        const nextChg = lastUpd ? lastUpd + TAG_COOLDOWN_MS : 0;
        return jsonResponse({ success: true, tags: getUserTags(p.name), nextChangeAt: nextChg > Date.now() ? nextChg : 0 });
      }

      case "get_users_by_tag": {
        if (!validateSession(p.name, p.token))
          return jsonResponse({ success: false, error: "セッション無効または期限切れ" });
        const tag = normalizeTag(p.tag);
        if (!tag) return jsonResponse({ success: false, error: "タグを指定してください" });
        // 本人がそのタグを（プラン上有効な範囲で）持っているか検証
        const myTags = activeTags(getUserTags(p.name), getUserPlan(p.name));
        if (!myTags.includes(tag))
          return jsonResponse({ success: false, error: "このタグはあなたに設定されていません" });
        return jsonResponse({ success: true, tag, users: findUsersByTag(tag, p.name) });
      }

      // ── 管理者操作（adminPass必須）──────────────────────────────

      case "admin_get_tags": {
        if (!checkAdminPass(p.adminPass)) return authError();
        const t = getUsersTable();
        const all = {};
        if (t.colTags >= 0) {
          for (let i = 1; i < t.rows.length; i++) {
            if (t.rows[i][0]) all[t.rows[i][0]] = parseJson(t.rows[i][t.colTags], []);
          }
        }
        return jsonResponse({ success: true, tags: all });
      }

      case "admin_save_tags": {
        if (!checkAdminPass(p.adminPass)) return authError();
        const r = sanitizeTags(p.tags, PRO_TAG_LIMIT); // 管理者は最大5つまで保存可
        if (r.error) return jsonResponse({ success: false, error: r.error });
        if (!setUserTags(p.name, r.tags))
          return jsonResponse({ success: false, error: "ユーザーが見つかりません" });
        return jsonResponse({ success: true, tags: r.tags });
      }

      case "verify_admin": {
        return jsonResponse({ success: checkAdminPass(p.password) });
      }

      case "admin_create_user": {
        if (!checkAdminPass(p.adminPass)) return authError();
        adminCreateUser(p.name); // PINは作成しない（ユーザーが初回設定）
        return jsonResponse({ success: true });
      }

      case "admin_save_user": {
        if (!checkAdminPass(p.adminPass)) return authError();
        adminSaveUser(p.name, p.displayName, p.licenseKey, p.links, p.plan, p.profile, p.pin, p.plusG);
        return jsonResponse({ success: true });
      }

      case "admin_toggle_plan": {
        if (!checkAdminPass(p.adminPass)) return authError();
        const newPlan = adminTogglePlan(p.name);
        return jsonResponse({ success: true, plan: newPlan });
      }

      case "admin_toggle_plusg": {
        if (!checkAdminPass(p.adminPass)) return authError();
        const newPlusG = adminTogglePlusG(p.name);
        return jsonResponse({ success: true, plusG: newPlusG });
      }

      case "admin_delete_user": {
        if (!checkAdminPass(p.adminPass)) return authError();
        deleteUser(p.name);
        return jsonResponse({ success: true });
      }

      case "admin_get_pin": {
        if (!checkAdminPass(p.adminPass)) return authError();
        const pin = getUserPin(p.name);
        return jsonResponse({ success: true, pin });
      }

      case "admin_get_all_pins": {
        if (!checkAdminPass(p.adminPass)) return authError();
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
        const rows  = sheet.getDataRange().getValues();
        const pins  = {};
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0]) pins[rows[i][0]] = String(rows[i][6] || "");
        }
        return jsonResponse({ success: true, pins });
      }

      case "admin_set_pin": {
        if (!checkAdminPass(p.adminPass)) return authError();
        if (!p.pin || !/^\d{6}$/.test(String(p.pin)))
          return jsonResponse({ success: false, error: "6桁の数字で入力してください" });
        setUserPin(p.name, String(p.pin));
        return jsonResponse({ success: true });
      }

      case "save_admin_pass": {
        // 現在のパスワードで認証してから変更
        if (!checkAdminPass(p.currentPass))
          return jsonResponse({ success: false, error: "現在のパスワードが違います" });
        setConfig("adminPass", p.password);
        return jsonResponse({ success: true });
      }

      // 旧互換エイリアス
      case "delete_user": {
        if (!checkAdminPass(p.adminPass)) return authError();
        deleteUser(p.name);
        return jsonResponse({ success: true });
      }

      case "save_licenses": {
        if (!checkAdminPass(p.adminPass)) return authError();
        saveLicenses(p.licenses);
        return jsonResponse({ success: true });
      }

      case "self_register": {
        const email = (p.email || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return jsonResponse({ success: false, error: "正しいメールアドレスを入力してください" });

        const normalized = normalizeEmail(email);
        const ss2 = SpreadsheetApp.getActiveSpreadsheet();
        const regSheet = ss2.getSheetByName(SHEET_REGISTRATIONS);
        const now = new Date();

        // 24h 重複チェック
        if (regSheet) {
          const regRows = regSheet.getDataRange().getValues();
          for (let i = 1; i < regRows.length; i++) {
            if (regRows[i][0] === normalized) {
              const registeredAt = new Date(regRows[i][3]);
              if ((now - registeredAt) < 24 * 60 * 60 * 1000) {
                const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - registeredAt)) / (60 * 60 * 1000));
                return jsonResponse({ success: false, error: `このメールアドレスは登録済みです。${hoursLeft}時間後に再度お試しください。` });
              }
            }
          }
        }

        // ユーザーID 生成（@より前、重複時は3文字追加）
        const usersSheet = ss2.getSheetByName(SHEET_USERS);
        const usersRows  = usersSheet ? usersSheet.getDataRange().getValues() : [];
        const existingIds = new Set(usersRows.slice(1).map(r => r[0]));
        let baseId = email.split("@")[0].replace(/[^a-z0-9_\-]/gi, "").toLowerCase().slice(0, 20);
        if (!baseId) baseId = "user";
        let userId = baseId;
        let attempts = 0;
        while (existingIds.has(userId) && attempts < 10) {
          userId = baseId + generateShortId(3);
          attempts++;
        }
        if (existingIds.has(userId))
          return jsonResponse({ success: false, error: "IDの生成に失敗しました。別のメールアドレスをお試しください。" });

        // ユーザー作成
        adminCreateUser(userId);
        if (regSheet) regSheet.appendRow([normalized, email, userId, now.toISOString()]);

        // メール送信（URLはpublicIdを使用 — メール由来IDを隠す）
        const newPublicId = getPublicId(userId);
        const cardUrl = SITE_URL + "?id=" + (newPublicId || userId) + "&new=1";
        try {
          MailApp.sendEmail({
            to: email,
            subject: "【デジタル名刺】登録完了 — あなたの名刺URLをお届けします",
            body: "登録ありがとうございます！\n\nあなた専用の名刺URLはこちらです：\n" + cardUrl + "\n\n初回アクセス時に6桁のPINの設定が必要です。\n\n— XYZ Digital Card プロジェクト"
          });
        } catch(mailErr) { /* メール失敗でも登録は成功 */ }
        try {
          MailApp.sendEmail({
            to: ADMIN_EMAIL,
            subject: "[名刺] 新規ユーザー登録: " + userId,
            body: "新規ユーザーが登録しました。\nID: " + userId + "\nメール: " + email + "\n登録日時: " + now.toISOString()
          });
        } catch(e) { /* ignore */ }

        return jsonResponse({ success: true, userId, cardUrl });
      }

      default:
        return jsonResponse({ error: "unknown action" });
    }
  } catch(err) {
    return jsonResponse({ error: err.message });
  }
}

// ── ユーザーデータ（公開用 — PIN送らない）───────────────────────
function getAllUsersPublic() {
  const t     = getUsersTable();
  const rows  = t.rows;
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const name        = row[0];
    const displayName = row[1] || "";
    const licenseKey  = row[2] || "";
    const links       = parseJson(row[3], []);
    const plan        = row[4] || "free";
    const profile     = parseJson(row[5], null);
    const hasPinSet   = !!(row[6]);                // PINの有無だけ公開（値は送らない）★
    const plusG       = row[7] === true || row[7] === "TRUE" || row[7] === 1 || row[7] === "1";
    const publicId    = t.colPublicId >= 0 ? String(row[t.colPublicId] || "") : "";
    // ★ tags は公開しない（列挙防止 — get_users_by_tag 経由のみ）
    result[name] = { displayName, plan, plusG, licenseKey, links, profile, hasPinSet, publicId };
  }
  return result;
}

// ── コンフィグ（adminPass送らない）──────────────────────────────
function getConfigPublic() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  const rows  = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] || rows[i][0] === "adminPass") continue; // ★ adminPass除去
    result[rows[i][0]] = rows[i][1];
  }
  return result;
}

// ── ユーザープロフィール保存（plan/plusG/pin変更不可）────────────
function saveUserProfile(name, displayName, links, profile) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  const linksJson   = JSON.stringify(links || []);
  const profileJson = profile ? JSON.stringify(profile) : "";
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== name) continue;
    sheet.getRange(i+1, 2).setValue(displayName || "");  // displayName
    sheet.getRange(i+1, 4).setValue(linksJson);           // links
    sheet.getRange(i+1, 6).setValue(profileJson);         // profile
    return true;
  }
  return false; // ユーザーが見つからない
}

// ── 管理者: ユーザー作成 ─────────────────────────────────────────
function adminCreateUser(name) {
  const t = getUsersTable();
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) return; // 既存
  }
  const existing = t.colPublicId >= 0
    ? new Set(t.rows.slice(1).map(r => String(r[t.colPublicId] || "")).filter(Boolean))
    : new Set();
  const publicId = generatePublicId(existing);
  // PIN空欄（ユーザーが初回設定）、publicId発行、tags空
  t.sheet.appendRow([name, "", "", "[]", "free", "", "", false, publicId, "[]"]);
}

// ── 管理者: フル保存 ─────────────────────────────────────────────
function adminSaveUser(name, displayName, licenseKey, links, plan, profile, pin, plusG) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  const linksJson   = JSON.stringify(links || []);
  const profileJson = profile ? JSON.stringify(profile) : "";
  const planVal     = plan || "free";
  const plusGVal    = plusG === true || plusG === "true" || plusG === 1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== name) continue;
    const currentPin = String(rows[i][6] || "");
    sheet.getRange(i+1, 1, 1, 8).setValues([[
      name,
      displayName || "",
      licenseKey  || "",
      linksJson,
      planVal,
      profileJson,
      pin !== undefined ? String(pin) : currentPin,
      plusGVal
    ]]);
    return;
  }
  // 新規（PINは空欄 — ユーザーが初回設定、publicId発行）
  const t = getUsersTable();
  const existing = t.colPublicId >= 0
    ? new Set(t.rows.slice(1).map(r => String(r[t.colPublicId] || "")).filter(Boolean))
    : new Set();
  sheet.appendRow([name, displayName||"", licenseKey||"", linksJson, planVal, profileJson, pin ? String(pin) : "", plusGVal, generatePublicId(existing), "[]"]);
}

// ── 管理者: プランtoggle ─────────────────────────────────────────
function adminTogglePlan(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== name) continue;
    const newPlan = rows[i][4] === "pro" ? "free" : "pro";
    sheet.getRange(i+1, 5).setValue(newPlan);
    return newPlan;
  }
  return "free";
}

// ── 管理者: +G toggle ────────────────────────────────────────────
function adminTogglePlusG(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== name) continue;
    const cur    = rows[i][7] === true || rows[i][7] === "TRUE" || rows[i][7] === 1;
    const newVal = !cur;
    sheet.getRange(i+1, 8).setValue(newVal);
    return newVal;
  }
  return false;
}

// ── ユーザー存在確認 ─────────────────────────────────────────────
function userExists(name) {
  if (!name) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) return true;
  }
  return false;
}

// ── PIN操作 ──────────────────────────────────────────────────────
function getUserPin(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) return String(rows[i][6] || "");
  }
  return "";
}

function setUserPin(name, pin) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) { sheet.getRange(i+1, 7).setValue(pin); return; }
  }
}

function checkPin(name, pin) {
  if (!name || !pin) return false;
  const stored = getUserPin(name);
  if (!stored) return false; // PIN未設定は拒否
  return String(stored) === String(pin);
}

// ── ユーザー削除 ─────────────────────────────────────────────────
function deleteUser(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) { sheet.deleteRow(i+1); return; }
  }
}

// ── セッション管理 ───────────────────────────────────────────────
function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

function createSession(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SESSIONS);
  cleanExpiredSessions(sheet);
  // 複数端末対応: 同一ユーザーの既存セッションは削除しない（期限切れのみ掃除）
  const token     = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sheet.appendRow([name, token, expiresAt]);
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
    sheet.deleteRow(i+1); // 期限切れ
    return false;
  }
  return false;
}

function cleanExpiredSessions(sheet) {
  const rows = sheet.getDataRange().getValues();
  const now  = Date.now();
  for (let i = rows.length - 1; i >= 1; i--) {
    try { if (new Date(rows[i][2]).getTime() < now) sheet.deleteRow(i+1); } catch {}
  }
}

// ── 管理者認証 ───────────────────────────────────────────────────
function checkAdminPass(password) {
  if (!password) return false;
  const stored = getConfig()["adminPass"];
  return !!stored && String(password) === String(stored);
}

// ── コンフィグ ────────────────────────────────────────────────────
function getConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  const rows  = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) result[rows[i][0]] = rows[i][1];
  }
  return result;
}

function setConfig(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) { sheet.getRange(i+1, 2).setValue(value); return; }
  }
  sheet.appendRow([key, value]);
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
  Object.entries(licenses).forEach(([key, val]) => {
    sheet.appendRow([key, val.plan||"pro", val.note||"", val.issuedAt||""]);
  });
}

// ── ヘルパー ──────────────────────────────────────────────────────
function parseJson(str, fallback) {
  try { return JSON.parse(str || "null") ?? fallback; }
  catch { return fallback; }
}

function authError() {
  return jsonResponse({ success: false, error: "認証失敗" });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── メール正規化（Gmail +alias / ドット除去）────────────────────────
function normalizeEmail(email) {
  const lower = email.toLowerCase().trim();
  const [local, domain] = lower.split("@");
  const cleanLocal = local.split("+")[0];
  if (["gmail.com", "googlemail.com"].includes(domain)) {
    return cleanLocal.replace(/\./g, "") + "@" + domain;
  }
  return cleanLocal + "@" + domain;
}

// ── ランダム英数字 n 文字 ──────────────────────────────────────────
function generateShortId(n) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ── publicId / tags ────────────────────────────────────────────────
// 列位置はヘッダー名で解決（既存シートの列順差異に対応）
function getUsersTable() {
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows   = sheet.getDataRange().getValues();
  const header = rows[0] || [];
  return {
    sheet, rows,
    colPublicId:     header.indexOf("publicId"), // 0-based, -1なら列なし
    colTags:         header.indexOf("tags"),
    colTagsUpdated:  header.indexOf("tagsUpdatedAt")
  };
}

// タグ最終保存日時（ms）を取得。未設定・列なしは 0
function getTagsUpdatedAt(name) {
  const t = getUsersTable();
  if (t.colTagsUpdated < 0) return 0;
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) {
      const v = t.rows[i][t.colTagsUpdated];
      if (!v) return 0;
      const ms = new Date(v).getTime();
      return isNaN(ms) ? 0 : ms;
    }
  }
  return 0;
}

function setTagsUpdatedAt(name, ms) {
  const t = getUsersTable();
  if (t.colTagsUpdated < 0) return;
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) {
      t.sheet.getRange(i + 1, t.colTagsUpdated + 1).setValue(new Date(ms).toISOString());
      return;
    }
  }
}

function generatePublicId(existingSet) {
  for (let a = 0; a < 20; a++) {
    let id = "zz";
    for (let i = 0; i < 9; i++) id += Math.floor(Math.random() * 10);
    if (!existingSet || !existingSet.has(id)) return id;
  }
  return "zz" + Date.now(); // フォールバック
}

// publicId未設定の全ユーザー行に発行（initSheetsから呼ばれる）
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
}

function getPublicId(name) {
  const t = getUsersTable();
  if (t.colPublicId < 0) return "";
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) return String(t.rows[i][t.colPublicId] || "");
  }
  return "";
}

// タグ正規化: NFKC → trim → 小文字 → 連続空白を1つに
function normalizeTag(tag) {
  let s = String(tag || "");
  try { s = s.normalize("NFKC"); } catch(e) {}
  s = s.trim().toLowerCase().replace(/\s+/g, " ");
  return s;
}

// 検証込みのタグ配列整形。問題があれば {error} を返す
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
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) return parseJson(t.rows[i][t.colTags], []);
  }
  return [];
}

// tags列のみ更新（他の列には一切触らない）
function setUserTags(name, tags) {
  const t = getUsersTable();
  if (t.colTags < 0) throw new Error("tags列がありません。initSheets()を実行してください");
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) {
      t.sheet.getRange(i + 1, t.colTags + 1).setValue(JSON.stringify(tags || []));
      return true;
    }
  }
  return false;
}

function getUserPlan(name) {
  const t = getUsersTable();
  for (let i = 1; i < t.rows.length; i++) {
    if (t.rows[i][0] === name) return t.rows[i][4] || "free";
  }
  return "free";
}

// プランに応じて有効なタグだけ返す（FREEは先頭1つ、PROは5つ）
function activeTags(tags, plan) {
  const limit = plan === "pro" ? PRO_TAG_LIMIT : FREE_TAG_LIMIT;
  return (tags || []).slice(0, limit);
}

// 同じタグを持つユーザー一覧（displayName + publicId のみ返す）
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
    result.push({
      displayName: row[1] || "",
      publicId: String(row[t.colPublicId] || "")
    });
  }
  return result;
}
