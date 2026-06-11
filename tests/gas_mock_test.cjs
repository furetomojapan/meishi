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
const taroToken = r.token;
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
t("平文PINでも認証成功", POST({ action: "verify_pin", name: "taro", pin: "222222" }).success === true);
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
t("PRO切替", POST({ action: "admin_toggle_plan", adminPass: AP, name: "taro" }).plan === "pro");
POST({ action: "save_user_profile", name: "taro", token: taroToken, displayName: "太郎",
  links: [{url:"https://a"},{url:"https://b"},{url:"https://c"}], profile: { phone: "090-1111-2222", address: "東京都渋谷区", tagPhone: "03-9999-0000", tagAddress: "渋谷区" } });
t("PROはリンク3件OK", JSON.parse(taroRow()[3]).length === 3);

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

// ── その他 ──
t("未知アクション", POST({ action: "nope" }).code === "UNKNOWN_ACTION");
t("ユーザー削除", POST({ action: "admin_delete_user", adminPass: AP, name: "hana" }).success === true && !sheets.users.rows.find(x => x[0] === "hana"));

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
