/**
 * デジタル名刺 - Google Apps Script バックエンド
 *
 * 【セットアップ手順】
 * 1. Google スプレッドシートを新規作成
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードを全選択して貼り付け
 * 4. デプロイ > 新しいデプロイ > 種類:ウェブアプリ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 5. デプロイ → 表示されるURLを index.html の GAS_URL に貼り付け
 */

const SHEET_USERS   = "users";
const SHEET_CONFIG  = "config";
const SHEET_LICENSE = "licenses";

// ── シート初期化（初回のみ自動実行） ───────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // users シート
  let us = ss.getSheetByName(SHEET_USERS);
  if (!us) {
    us = ss.insertSheet(SHEET_USERS);
    us.appendRow(["name", "displayName", "licenseKey", "links", "plan", "profile"]);
    us.getRange(1, 1, 1, 6).setFontWeight("bold");
  }

  // config シート
  let cs = ss.getSheetByName(SHEET_CONFIG);
  if (!cs) {
    cs = ss.insertSheet(SHEET_CONFIG);
    cs.appendRow(["key", "value"]);
    cs.appendRow(["adminPass", "admin123"]);
    cs.getRange(1, 1, 1, 2).setFontWeight("bold");
  }

  // licenses シート
  let ls = ss.getSheetByName(SHEET_LICENSE);
  if (!ls) {
    ls = ss.insertSheet(SHEET_LICENSE);
    ls.appendRow(["licenseKey", "plan", "note", "issuedAt"]);
    ls.appendRow(["MEISI-DEMO-PRO1-2026", "pro", "デモ用PROキー", "2026-06-07"]);
    ls.getRange(1, 1, 1, 4).setFontWeight("bold");
  }
}

// ── GET リクエスト ─────────────────────────────────────────────
function doGet(e) {
  const action = (e.parameter.action || "get_all");
  let result;

  try {
    if (action === "get_all") {
      result = { users: getAllUsers(), config: getConfig(), licenses: getLicenses() };
    } else if (action === "get_licenses") {
      result = getLicenses();
    } else {
      result = { error: "unknown action" };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST リクエスト ────────────────────────────────────────────
function doPost(e) {
  let payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch { return jsonResponse({ error: "invalid JSON" }); }

  const action = payload.action;
  try {
    if (action === "save_user") {
      saveUser(payload.name, payload.displayName, payload.licenseKey, payload.links, payload.plan, payload.profile);
      return jsonResponse({ success: true });

    } else if (action === "save_admin_pass") {
      setConfig("adminPass", payload.password);
      return jsonResponse({ success: true });

    } else if (action === "save_licenses") {
      saveLicenses(payload.licenses);
      return jsonResponse({ success: true });

    } else {
      return jsonResponse({ error: "unknown action" });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── ユーザーデータ ─────────────────────────────────────────────
function getAllUsers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const [name, displayName, licenseKey, linksJson, plan, profileJson] = rows[i];
    if (!name) continue;
    let links = [];
    try { links = JSON.parse(linksJson || "[]"); } catch {}
    let profile = null;
    try { profile = profileJson ? JSON.parse(profileJson) : null; } catch {}
    result[name] = { displayName: displayName || "", plan: plan || "free", licenseKey: licenseKey || "", links, profile };
  }
  return result;
}

function saveUser(name, displayName, licenseKey, links, plan, profile) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows = sheet.getDataRange().getValues();
  const linksJson = JSON.stringify(links || []);
  const planVal = plan || "free";
  const profileJson = profile ? JSON.stringify(profile) : "";
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) {
      sheet.getRange(i + 1, 1, 1, 6).setValues([[name, displayName || "", licenseKey || "", linksJson, planVal, profileJson]]);
      return;
    }
  }
  // 新規追加
  sheet.appendRow([name, displayName || "", licenseKey || "", linksJson, planVal, profileJson]);
}

// ── コンフィグ ─────────────────────────────────────────────────
function getConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  const rows = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) result[rows[i][0]] = rows[i][1];
  }
  return result;
}

function setConfig(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// ── ライセンス ─────────────────────────────────────────────────
function getLicenses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LICENSE);
  const rows = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const [licenseKey, plan, note, issuedAt] = rows[i];
    if (!licenseKey) continue;
    result[licenseKey] = { plan: plan || "pro", note: note || "", issuedAt: issuedAt || "" };
  }
  return result;
}

function saveLicenses(licenses) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LICENSE);
  // ヘッダー以外をクリア
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  // 書き直し
  Object.entries(licenses).forEach(([key, val]) => {
    sheet.appendRow([key, val.plan || "pro", val.note || "", val.issuedAt || ""]);
  });
}

// ── ヘルパー ───────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
