/**
 * gas_backend.js のモック結合テスト（フェーズ5）
 * 実行: node tests/gas_mock_test.cjs
 * SpreadsheetApp等のGASグローバルをメモリ実装で差し替え、doGet/doPostを直接呼ぶ
 */
const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");
const path = require("path");

// ── モック: シート ──
class Sheet {
  constructor(rows = []) { this.rows = rows; }
  getDataRange() { return { getValues: () => this.rows.map(r => [...r]) }; }
  appendRow(r) { this.rows.push([...r]); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows[0] ? this.rows[0].length : 0; }
  ensure(r, c) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r-1]; while (row.length < c) row.push(""); }
  deleteRow(r) { this.rows.splice(r-1, 1); }
  getRange(r, c, nr, nc) {
    const self = this;
    return {
      getValues: () => { const out = []; for (let i = 0; i < (nr||1); i++) { const row = self.rows[r-1+i] || []; const o = []; for (let j = 0; j < (nc||1); j++) o.push(row[c-1+j] ?? ""); out.push(o); } return out; },
      setValue: (v) => { self.ensure(r, c); self.rows[r-1][c-1] = v; },
      setValues: (vals) => { vals.forEach((row, i) => row.forEach((v, j) => { self.ensure(r+i, c+j); self.rows[r-1+i][c-1+j] = v; })); },
      setFontWeight: () => {},
      clearContent: () => { for (let i = 0; i < (nr||1); i++) for (let j = 0; j < (nc||1); j++) { self.ensure(r+i, c+j); self.rows[r-1+i][c-1+j] = ""; } }
    };
  }
}

const sheets = {};
const cacheStore = {};
const sandbox = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = new Sheet())
  })},
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: "sha256" },
    Charset: { UTF_8: "utf8" },
    computeDigest: (alg, str) => [...crypto.createHash("sha256").update(String(str), "utf8").digest()].map(b => b > 127 ? b - 256 : b)
  },
  CacheService: { getScriptCache: () => ({
    get: k => cacheStore[k] ?? null,
    put: (k, v) => { cacheStore[k] = v; },
    remove: k => { delete cacheStore[k]; }
  })},
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ContentService: { createTextOutput: (t) => ({ _t: t, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
  MailApp: { sendEmail: () => {} },
  Date, JSON, Object, Array, String, Number, Math, parseInt, RegExp, Set, Error
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "gas_backend.js"), "utf8"), sandbox);

const POST = (payload) => JSON.parse(vm.runInContext("doPost", sandbox)({ postData: { contents: JSON.stringify(payload) } })._t);
const GET  = (params)  => JSON.parse(vm.runInContext("doGet",  sandbox)({ parameter: params })._t);

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) pass++; else { fail++; console.log("FAIL:", name); } };

// ── 初期化 ──
vm.runInContext("initSheets", sandbox)();
t("シート作成", !!sheets.users && !!sheets.config && !!sheets.licenses && !!sheets.sessions);

// ── 管理者認証 ──
let r = POST({ action: "verify_admin", password: "admin123" });
t("初期パスでログイン成功", r.success === true);
t("初期パスはmustChange", r.mustChange === true);
t("誤パスワード拒否", POST({ action: "verify_admin", password: "wrong" }).success === false);
t("弱い新パス拒否", POST({ action: "save_admin_pass", currentPass: "admin123", password: "short" }).success === false);
t("admin123再使用拒否", POST({ action: "save_admin_pass", currentPass: "admin123", password: "admin123" }).success === false);
t("パス変更成功", POST({ action: "save_admin_pass", currentPass: "admin123", password: "newSecurePass1" }).success === true);
t("旧パス無効化", POST({ action: "verify_admin", password: "admin123" }).success === false);
r = POST({ action: "verify_admin", password: "newSecurePass1" });
t("新パスでログイン+mustChangeなし", r.success === true && !r.mustChange);
const AP = "newSecurePass1";
t("config上のパスがハッシュ", String(sheets.config.rows.find(x => x[0] === "adminPass")[1]).startsWith("sha256:"));

// ── ユーザー作成 ──
t("ユーザー作成", POST({ action: "admin_create_user", adminPass: AP, name: "taro" }).success === true);
t("認証なしの作成拒否", POST({ action: "admin_create_user", name: "evil" }).success === false);
const taroRow = () => sheets.users.rows.find(x => x[0] === "taro");
t("publicId発行(zz)", /^zz\d{9}$/.test(String(taroRow()[8])));
t("tagPublicId発行(zt)", /^zt\d{9}$/.test(String(taroRow()[11] || "")));

// ── PIN（ハッシュ化）──
r = POST({ action: "set_initial_pin", name: "taro", pin: "123456" });
t("初回PIN設定→トークン", r.success === true && typeof r.token === "string" && r.token.length === 64);
let taroToken = r.token;
t("PINセルがハッシュ", String(taroRow()[6]).startsWith("sha256:"));
t("二重初期設定拒否", POST({ action: "set_initial_pin", name: "taro", pin: "654321" }).success === false);
t("正PINで認証", POST({ action: "verify_pin", name: "taro", pin: "123456" }).success === true);
let last;
for (let i = 0; i < 5; i++) last = POST({ action: "verify_pin", name: "taro", pin: "000000" });
t("5回失敗でロック文言", /上限/.test(last.error));
t("ロック中は正PINも拒否", POST({ action: "verify_pin", name: "taro", pin: "123456" }).code === "PIN_LOCKED");
t("admin_set_pinでロック解除+PIN変更", POST({ action: "admin_set_pin", adminPass: AP, name: "taro", pin: "111111" }).success === true);
t("新PINで認証可", POST({ action: "verify_pin", name: "taro", pin: "111111" }).success === true);
// 平文移行
sheets.users.rows[sheets.users.rows.indexOf(taroRow())][6] = "222222"; // 平文を直接書き込み
r = POST({ action: "verify_pin", name: "taro", pin: "222222" });
t("平文PINでも認証成功", r.success === true);
taroToken = r.token; // v4.2: admin_set_pinが旧セッションを無効化するため再取得
t("認証成功後ハッシュへ自動移行", String(taroRow()[6]).startsWith("sha256:"));
// 廃止アクション
t("get_my_pin廃止", POST({ action: "get_my_pin", name: "taro", token: taroToken }).code === "UNKNOWN_ACTION");
t("admin_get_all_pins廃止", POST({ action: "admin_get_all_pins", adminPass: AP }).code === "UNKNOWN_ACTION");

// ── プロフィール保存（リンク上限）──
r = POST({ action: "save_user_profile", name: "taro", token: taroToken,
  displayName: "太郎", links: [{url:"https://a"},{url:"https://b"},{url:"https://c"}],
  profile: { phone: "090-1111-2222", address: "東京都渋谷区", tagPhone: "03-9999-0000", tagAddress: "渋谷区" } });
t("プロフィール保存", r.success === true);
t("FREEはリンク1件に制限", JSON.parse(taroRow()[3]).length === 1);
t("無効トークン拒否", POST({ action: "save_user_profile", name: "taro", token: "bad", links: [] }).code === "SESSION_INVALID");
// ── テーマカラー（v4.5: サーバー側矯正）──
POST({ action: "save_user_profile", name: "taro", token: taroToken, displayName: "太郎", links: [], profile: { themeColor: "purple" } });
t("FREE: PRO限定テーマ色は矯正", JSON.parse(taroRow()[5]).themeColor === "");
POST({ action: "save_user_profile", name: "taro", token: taroToken, displayName: "太郎", links: [], profile: { themeColor: "blue" } });
t("FREE: 許可テーマ色は保存", JSON.parse(taroRow()[5]).themeColor === "blue");
POST({ action: "save_user_profile", name: "taro", token: taroToken, displayName: "太郎", links: [], profile: { themeColor: "rainbow" } });
t("不正テーマ色キーは矯正", JSON.parse(taroRow()[5]).themeColor === "");
t("PRO切替", POST({ action: "admin_toggle_plan", adminPass: AP, name: "taro" }).plan === "pro");
POST({ action: "save_user_profile", name: "taro", token: taroToken, displayName: "太郎",
  links: [{url:"https://a"},{url:"https://b"},{url:"https://c"}], profile: { phone: "090-1111-2222", address: "東京都渋谷区", tagPhone: "03-9999-0000", tagAddress: "渋谷区", themeColor: "purple" } });
t("PROはリンク3件OK", JSON.parse(taroRow()[3]).length === 3);
t("PRO: 全テーマ色OK", JSON.parse(taroRow()[5]).themeColor === "purple");

// ── get_user（フル/タグビュー）──
const taroPub = String(taroRow()[8]), taroTag = String(taroRow()[11]);
r = GET({ action: "get_user", id: taroPub });
t("フル: 電話そのまま", r.user.profile.phone === "090-1111-2222");
t("フル: 内部名", r.name === "taro");
r = GET({ action: "get_user", id: taroTag });
t("タグビュー: 電話差し替え", r.user.profile.phone === "03-9999-0000");
t("タグビュー: 内部名秘匿", r.name === taroTag);
t("タグビュー: _tagView", r.user._tagView === true);
t("存在しないID", !!GET({ action: "get_user", id: "zz000000000" }).error);

// ── タグ ──
POST({ action: "admin_create_user", adminPass: AP, name: "hana" });
r = POST({ action: "set_initial_pin", name: "hana", pin: "333333" });
const hanaToken = r.token;
r = POST({ action: "save_tags", name: "taro", token: taroToken, tags: ["飲食", "all"] });
t("タグ保存+counts", r.success === true && typeof r.counts === "object");
t("クールダウン発動", POST({ action: "save_tags", name: "taro", token: taroToken, tags: ["変更"] }).code === "TAG_COOLDOWN");
t("全削除はいつでも可", POST({ action: "save_tags", name: "taro", token: taroToken, tags: [] }).success === true);
POST({ action: "admin_save_tags", adminPass: AP, name: "taro", tags: ["飲食"] }); // 管理者は制限対象外
POST({ action: "admin_save_tags", adminPass: AP, name: "hana", tags: ["飲食"] });
r = POST({ action: "get_users_by_tag", name: "hana", token: hanaToken, tag: "飲食" });
t("タグ仲間: taroが見える", r.success && r.users.length === 1 && r.users[0].displayName === "太郎");
t("タグ仲間: タグ用ID返却", /^zt\d{9}$/.test(r.users[0].publicId));
t("持っていないタグは拒否", POST({ action: "get_users_by_tag", name: "hana", token: hanaToken, tag: "DIY" }).code === "FORBIDDEN");
r = POST({ action: "get_my_tags", name: "taro", token: taroToken });
t("get_my_tags counts", r.success && r.counts["飲食"] === 1);

// ── admin_get_all / ライセンス ──
r = POST({ action: "admin_get_all", adminPass: AP });
t("admin_get_all 全員分", r.success && !!r.users.taro && !!r.users.hana);
t("admin_get_all licenseKey含む", "licenseKey" in r.users.taro);
t("save_licenses", POST({ action: "save_licenses", adminPass: AP, licenses: { "KEY-1": { plan: "pro" } } }).success === true);
t("ライセンス反映", POST({ action: "admin_get_all", adminPass: AP }).licenses["KEY-1"].plan === "pro");

// ── 自己登録 ──
r = POST({ action: "self_register", email: "test@example.com" });
t("自己登録成功", r.success === true && !!r.userId);
t("24h重複拒否", POST({ action: "self_register", email: "test@example.com" }).code === "DUPLICATE");
t("不正メール拒否", POST({ action: "self_register", email: "bad" }).success === false);

// ── トライアル（v4.6: 新規登録7日間PRO+＋G・期限後は非表示でデータ保持）──
const regId = r.userId;
const regRow = () => sheets.users.rows.find(x => x[0] === regId);
const trialCol = sheets.users.rows[0].indexOf("trialEnd");
t("trialEnd列あり", trialCol >= 0);
t("自己登録でtrialEnd≈7日後", Math.abs(new Date(String(regRow()[trialCol])).getTime() - (Date.now() + 7 * 86400000)) < 60000);
r = GET({ action: "get_user", id: regId });
t("トライアル中: 実効pro+＋G+trialEnd", r.user.plan === "pro" && r.user.plusG === true && r.user.trialEnd > Date.now());
r = POST({ action: "set_initial_pin", name: regId, pin: "888888" });
const regToken = r.token;
POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [{url:"https://1"},{url:"https://2"},{url:"https://3"}], profile: { themeColor: "purple" } });
t("トライアル中: リンク複数保存可", JSON.parse(regRow()[3]).length === 3);
t("トライアル中: PRO限定テーマ色OK", JSON.parse(regRow()[5]).themeColor === "purple");
// 期限切れにする
regRow()[trialCol] = new Date(Date.now() - 1000).toISOString();
r = GET({ action: "get_user", id: regId });
t("期限後: 実効free+＋G無効", r.user.plan === "free" && r.user.plusG === false && !r.user.trialEnd);
t("期限後: リンクはFREE上限のみ返す", r.user.links.length === 1);
t("期限後: PRO限定テーマ色は非表示", String((r.user.profile || {}).themeColor || "") === "");
t("期限後: シート上はデータ保持", JSON.parse(regRow()[3]).length === 3 && JSON.parse(regRow()[5]).themeColor === "purple");
POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [{url:"https://new1"}], profile: { themeColor: "" } });
t("期限後の保存: 隠しリンク温存", (() => { const L = JSON.parse(regRow()[3]); return L.length === 3 && L[0].url === "https://new1" && L[1].url === "https://2"; })());
t("期限後の保存: PRO色温存", JSON.parse(regRow()[5]).themeColor === "purple");
POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [{url:"https://new1"}], profile: { themeColor: "blue" } });
t("期限後: FREE色の明示選択は上書き", JSON.parse(regRow()[5]).themeColor === "blue");
r = POST({ action: "admin_get_all", adminPass: AP });
t("admin_get_all: 生plan+全リンク返却", r.users[regId].plan === "free" && r.users[regId].links.length === 3);
r = POST({ action: "admin_set_trial", adminPass: AP, name: regId, days: 7 });
t("admin_set_trial付与", r.success === true && r.trialEnd > Date.now());
t("付与後: 実効pro", GET({ action: "get_user", id: regId }).user.plan === "pro");
t("admin_set_trial終了", POST({ action: "admin_set_trial", adminPass: AP, name: regId, days: 0 }).success === true
  && GET({ action: "get_user", id: regId }).user.plan === "free");
t("admin_set_trial認証必須", POST({ action: "admin_set_trial", name: regId, days: 7 }).success === false);

// ── 独自背景画像（v4.7: 専用列に分離・高画質化）──
const imgCols = { f: sheets.users.rows[0].indexOf("frontImage"), b: sheets.users.rows[0].indexOf("backImage") };
t("画像列あり", imgCols.f >= 0 && imgCols.b >= 0);
const IMG = "data:image/webp;base64," + "A".repeat(2000);
POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [], profile: { themeColor: "blue", frontImageUrl: IMG } });
t("画像は専用列に保存", String(regRow()[imgCols.f]) === IMG);
t("profile列に画像は残らない", !JSON.parse(regRow()[5]).frontImageUrl);
r = GET({ action: "get_user", id: regId });
t("get_user: 画像をprofileに注入", r.user.profile.frontImageUrl === IMG);
r = POST({ action: "admin_get_all", adminPass: AP });
t("admin_get_all: 画像注入", r.users[regId].profile.frontImageUrl === IMG);
// 削除
POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [], profile: { themeColor: "blue", frontImageUrl: "" } });
t("画像削除で列クリア", String(regRow()[imgCols.f]) === "");
// 旧形式（profile内埋め込み）フォールバック
regRow()[5] = JSON.stringify({ themeColor: "", backImageUrl: "data:image/jpeg;base64,LEGACY" });
r = GET({ action: "get_user", id: regId });
t("旧形式: 埋め込み画像を返す", r.user.profile.backImageUrl === "data:image/jpeg;base64,LEGACY");
POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [], profile: { themeColor: "", backImageUrl: "data:image/jpeg;base64,LEGACY" } });
t("旧形式: 保存で専用列へ自動移行", String(regRow()[imgCols.b]) === "data:image/jpeg;base64,LEGACY" && !JSON.parse(regRow()[5]).backImageUrl);
// バリデーション
r = POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [], profile: { frontImageUrl: "data:image/webp;base64," + "B".repeat(50001) } });
t("サイズ超過は拒否", r.code === "VALIDATION");
POST({ action: "save_user_profile", name: regId, token: regToken, displayName: "新規",
  links: [], profile: { frontImageUrl: "javascript:alert(1)" } });
t("不正スキームは矯正", String(regRow()[imgCols.f]) === "");
// 管理者保存でも分離
POST({ action: "admin_save_user", adminPass: AP, name: regId, displayName: "新規", links: [],
  plan: "free", profile: { themeColor: "", frontImageUrl: IMG } });
t("admin保存: 画像を専用列へ", String(regRow()[imgCols.f]) === IMG && !JSON.parse(regRow()[5]).frontImageUrl);
t("admin保存: サイズ超過拒否", POST({ action: "admin_save_user", adminPass: AP, name: regId, displayName: "新規",
  links: [], plan: "free", profile: { frontImageUrl: "data:image/png;base64," + "C".repeat(50001) } }).code === "VALIDATION");

// ── PINリセットの徹底（v4.2バグ修正） ──
r = POST({ action: "verify_pin", name: "taro", pin: "222222" });
const taroToken2 = r.token;
t("リセット前: トークン有効", POST({ action: "get_my_tags", name: "taro", token: taroToken2 }).success === true);
t("PINリセット成功", POST({ action: "admin_reset_pin", adminPass: AP, name: "taro" }).success === true);
t("リセット後: hasPinSet=false", POST({ action: "admin_get_all", adminPass: AP }).users.taro.hasPinSet === false);
t("リセット後: 端末記憶も無効", POST({ action: "get_my_tags", name: "taro", token: taroToken2 }).code === "SESSION_INVALID");
t("リセット後: 初回設定が可能", POST({ action: "set_initial_pin", name: "taro", pin: "777777" }).success === true);

// ── その他 ──
t("未知アクション", POST({ action: "nope" }).code === "UNKNOWN_ACTION");
t("ユーザー削除", POST({ action: "admin_delete_user", adminPass: AP, name: "hana" }).success === true && !sheets.users.rows.find(x => x[0] === "hana"));

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
