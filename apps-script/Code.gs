/* =====================================================================
   Pingping Portfolio — BACKEND (Google Apps Script Web App)
   ---------------------------------------------------------------------
   Runs as piraya.portfolio@gmail.com. Reads/writes the 25-column Google
   Sheet and uploads certificate files to a Drive folder.
   Actions: verify, get/save profile, list, add, update, delete.
   Deploy: Deploy > New deployment > Web app
           (Execute as: Me, Who has access: Anyone). See SETUP.md.
   IMPORTANT: after editing this file you must re-deploy a NEW VERSION.
   ===================================================================== */

// ---- CONFIG (already filled with this project's IDs) ----
var SHEET_ID   = "11HwCxqYSK96hCXnqKzftd1dqphJ_t04VmVcY39Fwih8";  // "Pingping_Portfolio"
var SHEET_NAME = "";                                              // "" = first/active tab
var FOLDER_ID  = "13quDAcUu8dpJoWYxUp1ZtzC4XWOvBbil";             // "Pingping Certificates"
var PROFILE_SHEET_NAME = "_Profile";

// ---- Admin authorization. CHANGE FAMILY_PASSCODE ONLY IN APPS SCRIPT. ----
// Keep the real passcode out of the public GitHub repository.
var FAMILY_PASSCODE = "change-me-family";
var FIREBASE_API_KEY = "AIzaSyA4HeBbchLyDjzdjAzeTrk9EuXX7IB5u1I";
var FAMILY_ROLES = {
  "UB8EoJajoSXHsXQFyOzJVituP3G2": "Dad",
  "xUPFfDuynPZx2SW1R57YL8fegOp1": "Mom",
  "UyIHDYidW5e4XdOVpqKV8XtBiSH3": "Pingping",
  "V7H0qFyOwoePChyEG4ju5QYkWNl2": "Pingping"
};

// Exact column order of the sheet (must match row 1).
var HEADERS = [
  "Record ID", "Year", "Month", "Age", "Grade", "School", "Category",
  "Activity / Competition Name", "Organizer", "Level", "Result / Award",
  "Score / Rank", "Participation Type", "Frequency", "Duration", "Role",
  "Evidence Type", "Evidence Link (Drive / YouTube)", "Student Reflection",
  "Dad's Memory", "Mom's Memory", "Importance Level", "Use for University", "Notes",
  "Last Edited By"
];

/* ---------------------------------------------------------------- */
function ensureAchievementSchema_(sh) {
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).clearDataValidations().setValues([HEADERS]);
    return;
  }
  var lastColumn = Math.max(sh.getLastColumn(), 1);
  // Header cells must not inherit the dropdown validation used by data rows.
  sh.getRange(1, 1, 1, Math.max(lastColumn, HEADERS.length)).clearDataValidations();
  var current = sh.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) {
    return String(value || "").trim();
  });

  // Month was added after Year. Insert the whole column so every existing
  // value moves with its original header and no record data is overwritten.
  var yearIndex = current.indexOf("Year");
  if (current.indexOf("Month") < 0 && yearIndex >= 0) {
    sh.insertColumnAfter(yearIndex + 1);
    sh.getRange(1, yearIndex + 2).setValue("Month");
    if (sh.getMaxRows() > 1) {
      sh.getRange(2, yearIndex + 2, sh.getMaxRows() - 1, 1).clearDataValidations();
    }
    lastColumn = Math.max(sh.getLastColumn(), 1);
    current = sh.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) {
      return String(value || "").trim();
    });
  }
  var legacyParent = current.indexOf("Parent Note");
  var dadMemory = current.indexOf("Dad's Memory");
  var momMemory = current.indexOf("Mom's Memory");
  var dadNote = current.indexOf("Dad's Note");
  var momNote = current.indexOf("Mom's Note");

  // Preserve legacy text and also recover safely if an earlier migration
  // inserted the Mom column but stopped before naming its header.
  var dadIndex = dadMemory;
  if (dadIndex < 0 && dadNote >= 0) {
    dadIndex = dadNote;
    sh.getRange(1, dadIndex + 1).setValue("Dad's Memory");
  } else if (dadIndex < 0 && legacyParent >= 0) {
    dadIndex = legacyParent;
    sh.getRange(1, dadIndex + 1).setValue("Dad's Memory");
  }

  if (momMemory < 0 && momNote >= 0) {
    sh.getRange(1, momNote + 1).setValue("Mom's Memory");
  } else if (momMemory < 0 && momNote < 0 && dadIndex >= 0) {
    var expectedMomIndex = dadIndex + 1;
    if (String(current[expectedMomIndex] || "").trim() === "") {
      sh.getRange(1, expectedMomIndex + 1).setValue("Mom's Memory");
    } else {
      sh.insertColumnAfter(dadIndex + 1);
      sh.getRange(1, dadIndex + 2).setValue("Mom's Memory");
    }
  }

  // This audit column is appended at the end so existing records never shift.
  var updatedLastColumn = Math.max(sh.getLastColumn(), 1);
  var updatedHeaders = sh.getRange(1, 1, 1, updatedLastColumn).getValues()[0].map(function (value) {
    return String(value || "").trim();
  });
  if (updatedHeaders.indexOf("Last Edited By") < 0) {
    sh.getRange(1, HEADERS.length).setValue("Last Edited By");
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sh) sh = ss.getSheets()[0];
  ensureAchievementSchema_(sh);
  return sh;
}

function getProfile_() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(PROFILE_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return {};
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  var profile = {};
  values.forEach(function (row) {
    var key = String(row[0] || "").trim();
    if (key) profile[key] = row[1] == null ? "" : String(row[1]);
  });
  if (profile.interests) {
    try { profile.interests = JSON.parse(profile.interests); }
    catch (ignore) { profile.interests = profile.interests.split(",").map(function (s) { return s.trim(); }).filter(String); }
  } else {
    profile.interests = [];
  }
  return profile;
}

function uploadProfilePhoto_(photoFile) {
  if (!photoFile || !photoFile.dataBase64) return "";
  var mimeType = String(photoFile.mimeType || "").toLowerCase();
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) throw new Error("Profile photo must be JPG, PNG, WebP, or GIF.");
  var bytes = Utilities.base64Decode(photoFile.dataBase64);
  if (bytes.length > 5 * 1024 * 1024) throw new Error("Profile photo must be 5 MB or smaller.");
  var root = DriveApp.getFolderById(FOLDER_ID);
  var folders = root.getFoldersByName("Profile Photos");
  var folder = folders.hasNext() ? folders.next() : root.createFolder("Profile Photos");
  var safeName = String(photoFile.name || "profile-photo").replace(/[\r\n|]+/g, " ");
  var file = folder.createFile(Utilities.newBlob(bytes, mimeType, new Date().getTime() + "-" + safeName));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (ignore) {}
  return "https://drive.google.com/file/d/" + file.getId() + "/view";
}

function saveProfile_(data, user) {
  var name = String(data.name || "").trim();
  if (!name) return { ok: false, error: "Display name is required" };
  var current = getProfile_();
  var photo = data.photo || current.photo || "";
  if (data.photoFile) photo = uploadProfilePhoto_(data.photoFile);
  var interests = String(data.interests || "").split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(String);
  var profile = {
    name: name,
    tagline: String(data.tagline || "").trim(),
    summary: String(data.summary || "").trim(),
    photo: photo,
    location: String(data.location || "").trim(),
    interests: interests
  };
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(PROFILE_SHEET_NAME) || ss.insertSheet(PROFILE_SHEET_NAME);
  var rows = [
    ["Key", "Value"],
    ["name", profile.name],
    ["tagline", profile.tagline],
    ["summary", profile.summary],
    ["photo", profile.photo],
    ["location", profile.location],
    ["interests", JSON.stringify(profile.interests)]
  ];
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.setFrozenRows(1);
  return { ok: true, user: user, profile: profile };
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
// Ask Firebase Authentication to validate the fresh ID token and return
// the signed-in account. The web API key is a public project identifier.
function firebaseUserFor_(idToken) {
  if (!idToken) return null;
  var response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(FIREBASE_API_KEY),
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() !== 200) return null;

  var body = JSON.parse(response.getContentText() || "{}");
  var account = body.users && body.users[0];
  if (!account || !FAMILY_ROLES[account.localId]) return null;
  return {
    name: FAMILY_ROLES[account.localId],
    uid: account.localId,
    email: account.email || ""
  };
}

function authorizedUser_(data) {
  if (!data || data.passcode !== FAMILY_PASSCODE) return null;
  return firebaseUserFor_(data.firebaseToken);
}
function pad4_(n) { return ("0000" + n).slice(-4); }

// Upload base64 files to Drive and keep their names for the portfolio viewer.
function uploadFiles_(files) {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var links = [];
  if ((files || []).length > 5) throw new Error("A maximum of 5 evidence files is allowed per achievement.");
  (files || []).forEach(function (f) {
    if (!f || !f.dataBase64) return;
    var mimeType = String(f.mimeType || "").toLowerCase();
    var fileName = String(f.name || "Evidence");
    if (mimeType.indexOf("video/") === 0 || /\.(mp4|mov|avi|mkv|webm|m4v|wmv)$/i.test(fileName)) {
      throw new Error("Video files are not accepted. Add a video link instead.");
    }
    if (mimeType.indexOf("image/") !== 0 && mimeType !== "application/pdf" && !/\.pdf$/i.test(fileName)) {
      throw new Error("Only image and PDF evidence files are accepted.");
    }
    var bytes = Utilities.base64Decode(f.dataBase64);
    var blob = Utilities.newBlob(bytes, f.mimeType || "application/octet-stream", fileName);
    var file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (ignore) {}
    links.push({
      name: fileName,
      evidenceType: f.evidenceType || "Evidence",
      url: "https://drive.google.com/file/d/" + file.getId() + "/view"
    });
  });
  return links;
}

// Build a full row (25 cells) in HEADERS order.
function buildRow_(data, recordId, evidence, editorRole) {
  return [
    recordId,
    data.year || "", data.month || "", data.age || "", data.grade || "", data.school || "",
    data.category || "", data.title || "", data.organizer || "", data.level || "",
    data.result || "", data.rank || "", data.participationType || "",
    data.frequency || "", data.duration || "", data.role || "",
    data.evidenceType || "", evidence, data.reflection || "",
    data.dadNote || data.parentNote || "", data.momNote || "",
    data.importance || "", data.useUniversity || "",
    data.notes || "",
    editorRole || data.lastEditedBy || ""
  ];
}

// Find 1-based sheet row number for a Record ID (column A). -1 if not found.
function findRow_(sh, recordId) {
  if (!recordId) return -1;
  var col = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < col.length; i++) if (String(col[i][0]).trim() === String(recordId).trim()) return i + 1;
  return -1;
}

// Combine evidence text (existing/edited links) with newly uploaded file links.
function combineEvidence_(evidenceText, newLinks) {
  var lines = String(evidenceText || "").split(/\n+|;\s*(?=https?:)|,\s*(?=https?:)/i).map(function (s) { return s.trim(); }).filter(String);
  var uploaded = (newLinks || []).map(function (file) {
    var type = String(file.evidenceType || "Evidence").replace(/[\r\n|]+/g, " ").trim();
    var name = String(file.name || "Evidence").replace(/[\r\n|]+/g, " ").trim();
    return type + " - " + name + " | " + file.url;
  });
  return lines.concat(uploaded).join("\n");
}

// Run this once from the Apps Script editor after adding UrlFetchApp.
// A 400 response is expected; the purpose is to trigger Google's consent screen.
function authorizeFirebaseAccess() {
  var response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(FIREBASE_API_KEY),
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: "authorization-check" }),
      muteHttpExceptions: true
    }
  );
  Logger.log("Firebase external-request permission granted. Test response: " + response.getResponseCode());
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "profile") return json_({ ok: true, profile: getProfile_() });
  if (e && e.parameter && e.parameter.action === "share") {
    var recordId = String(e.parameter.id || "").trim();
    var entry = getEntryById_(recordId);
    return entry
      ? json_({ ok: true, profile: getProfile_(), entry: entry })
      : json_({ ok: false, error: "Shared achievement not found" });
  }
  return json_({ ok: true, service: "pingping-portfolio", time: new Date().toISOString() });
}

function doPost(e) {
  var res;
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var user = authorizedUser_(data);
    if (data.action === "verify") {
      res = user ? { ok: true, user: user.name, email: user.email } : { ok: false, error: "Invalid family passcode or Google account" };
    } else if (!user) {
      res = { ok: false, error: "Invalid family passcode or Google account" };
    } else if (data.action === "getProfile") {
      res = { ok: true, profile: getProfile_() };
    } else if (data.action === "saveProfile") {
      res = saveProfile_(data, user.name);
    } else if (data.action === "list") {
      res = listEntries_();
    } else if (data.action === "add") {
      res = addEntry_(data, user.name);
    } else if (data.action === "update") {
      res = updateEntry_(data, user.name);
    } else if (data.action === "delete") {
      res = deleteEntry_(data, user.name);
    } else {
      res = { ok: false, error: "Unknown action" };
    }
  } catch (err) {
    var message = String(err);
    if (message.indexOf("script.external_request") >= 0 || message.indexOf("UrlFetchApp.fetch") >= 0) {
      message = "Apps Script needs one-time Firebase permission. Run authorizeFirebaseAccess from the Apps Script editor, approve access, then try again.";
    }
    res = { ok: false, error: message };
  }
  return json_(res);
}

function listEntries_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, entries: [] };
  var values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var keys = ["recordId","year","month","age","grade","school","category","title","organizer","level",
              "result","rank","participationType","frequency","duration","role","evidenceType",
              "evidenceLink","reflection","dadNote","momNote","importance","useUniversity","notes","lastEditedBy"];
  var entries = [];
  values.forEach(function (row) {
    if (!row[7] && !row[0]) return;            // skip fully empty
    if (!String(row[7]).trim()) return;        // skip rows without an activity name
    var o = {};
    keys.forEach(function (k, i) { o[k] = row[i] == null ? "" : String(row[i]); });
    entries.push(o);
  });
  entries.reverse();                           // newest added last -> show last first
  return { ok: true, entries: entries };
}

function getEntryById_(recordId) {
  if (!recordId) return null;
  var entries = listEntries_().entries;
  for (var i = 0; i < entries.length; i++) {
    if (String(entries[i].recordId).trim() === recordId) return entries[i];
  }
  return null;
}

function addEntry_(data, user) {
  if (!data.title) return { ok: false, error: "Activity / Competition Name is required" };
  var newLinks = uploadFiles_(data.files);
  var evidence = combineEvidence_(data.evidenceLink, newLinks);
  var sh = getSheet_();
  var recordId = "PP-" + pad4_(sh.getLastRow());     // header row 1 -> first data PP-0001
  sh.appendRow(buildRow_(data, recordId, evidence, user));
  return { ok: true, user: user, recordId: recordId, links: newLinks };
}

function updateEntry_(data, user) {
  if (!data.recordId) return { ok: false, error: "Missing record id" };
  if (!data.title) return { ok: false, error: "Activity / Competition Name is required" };
  var sh = getSheet_();
  var rowNum = findRow_(sh, data.recordId);
  if (rowNum < 0) return { ok: false, error: "Record not found: " + data.recordId };
  var newLinks = uploadFiles_(data.files);
  var evidence = combineEvidence_(data.evidenceLink, newLinks);   // edited links + any new uploads
  sh.getRange(rowNum, 1, 1, HEADERS.length).setValues([buildRow_(data, data.recordId, evidence, user)]);
  return { ok: true, user: user, recordId: data.recordId, updated: true };
}

function deleteEntry_(data, user) {
  if (!data.recordId) return { ok: false, error: "Missing record id" };
  var sh = getSheet_();
  var rowNum = findRow_(sh, data.recordId);
  if (rowNum < 0) return { ok: false, error: "Record not found: " + data.recordId };
  sh.deleteRow(rowNum);
  return { ok: true, user: user, recordId: data.recordId, deleted: true };
}
