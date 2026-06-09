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

const SHEET_USERS    = "users";
const SHEET_CONFIG   = "config";
const SHEET_LICENSE  = "licenses";
const SHEET_SESSIONS = "sessions";
const SESSION_TTL_MS = 60 * 60 * 1000; // 60分

// ── シート初期化 ──────────────────────────────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // users シート（pin・plusG列を追加）
  let us = ss.getSheetByName(SHEET_USERS);
  if (!us) {
    us = ss.insertSheet(SHEET_USERS);
    us.appendRow(["name","displayName","licenseKey","links","plan","profile","pin","plusG"]);
    us.getRange(1,1,1,8).setFontWeight("bold");
  } else {
    // 既存シートにpin/plusG列がなければ追加
    const header = us.getRange(1, 1, 1, us.getLastColumn()).getValues()[0];
    if (!header.includes("pin"))  us.getRange(1, header.length + 1).setValue("pin");
    if (!header.includes("plusG")) us.getRange(1, header.length + 2).setValue("plusG");
  }

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
        saveUserProfile(p.name, p.displayName, p.links, p.profile);
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
        const currentPin = getUserPin(p.name);
        if (currentPin) return jsonResponse({ success: false, error: "PINは既に設定されています" });
        setUserPin(p.name, String(p.pin));
        const token = createSession(p.name);
        return jsonResponse({ success: true, token });
      }

      // ── 管理者操作（adminPass必須）──────────────────────────────

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

      default:
        return jsonResponse({ error: "unknown action" });
    }
  } catch(err) {
    return jsonResponse({ error: err.message });
  }
}

// ── ユーザーデータ（公開用 — PIN送らない）───────────────────────
function getAllUsersPublic() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
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
    result[name] = { displayName, plan, plusG, licenseKey, links, profile, hasPinSet };
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
    return;
  }
}

// ── 管理者: ユーザー作成 ─────────────────────────────────────────
function adminCreateUser(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) return; // 既存
  }
  sheet.appendRow([name, "", "", "[]", "free", "", "", false]); // PIN空欄（ユーザーが初回設定）
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
  // 新規（PINは空欄 — ユーザーが初回設定）
  sheet.appendRow([name, displayName||"", licenseKey||"", linksJson, planVal, profileJson, pin ? String(pin) : "", plusGVal]);
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
  // 同一ユーザーの既存セッションを削除
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === name) sheet.deleteRow(i+1);
  }
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
