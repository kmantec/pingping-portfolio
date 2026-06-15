/* Pingping Portfolio — Admin (login + add/edit/delete)
   Talks to the Apps Script Web App in data/config.js (scriptUrl).
   Actions: verify, list, add, update, delete. Passcode verified server-side. */

var $ = function (s) { return document.querySelector(s); };
function scriptUrl() { return (window.PORTFOLIO_CONFIG || {}).scriptUrl || ""; }

/* POST as text/plain to avoid a CORS preflight (Apps Script needs simple requests).
   Every request includes a fresh Firebase ID token so the backend can identify
   Dad, Mom or Pingping even when everyone shares the same family passcode. */
async function callScript(payload) {
  if (typeof window.getPortfolioAuth !== "function") throw new Error("Google sign-in session is unavailable.");
  var auth = await window.getPortfolioAuth();
  payload.firebaseToken = auth.idToken;
  return fetch(scriptUrl(), { method: "POST", body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
}

function readFile(item) {
  var file = item.file;
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function () {
      var s = String(fr.result || ""); var comma = s.indexOf(",");
      resolve({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        evidenceType: item.evidenceType,
        dataBase64: comma >= 0 ? s.slice(comma + 1) : s
      });
    };
    fr.onerror = function () { reject(fr.error); };
    fr.readAsDataURL(file);
  });
}

function val(id) { var el = $(id); return el ? el.value.trim() : ""; }
function setVal(id, v) { var el = $(id); if (el) el.value = v || ""; }

var FIELD_IDS = {
  title: "#f-title", category: "#f-category", year: "#f-year", level: "#f-level",
  result: "#f-result", rank: "#f-rank", organizer: "#f-organizer", age: "#f-age",
  grade: "#f-grade", school: "#f-school", participationType: "#f-ptype", role: "#f-role",
  frequency: "#f-frequency", duration: "#f-duration", evidenceType: "#f-etype",
  evidenceLink: "#f-evlink", reflection: "#f-reflection", dadNote: "#f-dad-note",
  momNote: "#f-mom-note",
  importance: "#f-importance", useUniversity: "#f-uni", notes: "#f-notes"
};

function buildPayload(passcode, files) {
  var p = { passcode: passcode, files: files };
  for (var k in FIELD_IDS) p[k] = val(FIELD_IDS[k]);
  // Compatibility with an older Apps Script deployment during the migration.
  p.parentNote = p.dadNote;
  return p;
}

function setMsg(el, text, type) { el.textContent = text; el.className = "form-msg" + (type ? " " + type : ""); }

var session = { passcode: "", user: "", email: "" };
var editingId = "";          // "" = add mode; otherwise editing this Record ID
var entriesCache = [];
var listState = { query: "", category: "", year: "", pageSize: 10, page: 1 };
var pendingFiles = [];
var pendingFileSequence = 1;
var baseEvidenceType = "";
var EVIDENCE_FILE_TYPES = ["Certificate", "Medal / Trophy", "Photo", "Document"];
var profileState = { photo: "", file: null, previewUrl: "" };
var SUGGESTION_FIELDS = {
  "level-options": "level",
  "result-options": "result",
  "organizer-options": "organizer",
  "grade-options": "grade",
  "school-options": "school",
  "role-options": "role",
  "frequency-options": "frequency",
  "duration-options": "duration"
};

function populateYearOptions(selected) {
  var select = $("#f-year");
  if (!select) return;
  var currentYear = new Date().getFullYear();
  var latestYear = currentYear + 1;
  var value = String(selected || "");
  select.innerHTML = '<option value="">— Select year —</option>';
  for (var year = latestYear; year >= 2010; year--) {
    var option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    select.appendChild(option);
  }
  select.value = value;
}

function splitEvidenceLines(value) {
  return String(value || "").split(/\n+|;\s*(?=https?:)|,\s*(?=https?:)/i).map(function (line) {
    return line.trim();
  }).filter(Boolean);
}

function evidenceLineInfo(line) {
  var named = String(line || "").match(/^(.*?)\s*\|\s*(https?:\/\/.*)$/i);
  var label = named ? named[1].trim() : "Linked evidence";
  var url = named ? named[2].trim() : String(line || "").trim();
  if (!named) {
    try { label = new URL(url).hostname.replace(/^www\./, ""); }
    catch (ignore) {}
  }
  return { label: label || "Evidence", url: url };
}

function renderSavedEvidence() {
  var field = $("#savedEvidenceField");
  var list = $("#savedEvidenceList");
  if (!field || !list) return;
  var lines = splitEvidenceLines(val("#f-evlink"));
  field.hidden = !editingId || !lines.length;
  if (field.hidden) { list.innerHTML = ""; return; }
  list.innerHTML = lines.map(function (line, index) {
    var item = evidenceLineInfo(line);
    return '<div class="saved-evidence-item">' +
      '<div class="saved-evidence-info"><strong>' + esc(item.label) + '</strong>' +
      '<span title="' + esc(item.url) + '">' + esc(item.url) + '</span></div>' +
      '<button type="button" class="mini danger" data-remove-saved-evidence="' + index + '">Remove</button>' +
      '</div>';
  }).join("");
}

function removeSavedEvidence(index) {
  var lines = splitEvidenceLines(val("#f-evlink"));
  if (index < 0 || index >= lines.length) return;
  lines.splice(index, 1);
  setVal("#f-evlink", lines.join("\n"));
  renderSavedEvidence();
  setMsg($("#formMsg"), "Attachment removed from this achievement. Click Save changes to confirm.", "");
}

function refreshSuggestions() {
  for (var listId in SUGGESTION_FIELDS) {
    var list = document.getElementById(listId);
    if (!list) continue;
    var seen = {};
    Array.prototype.forEach.call(list.options, function (option) {
      seen[String(option.value || "").toLowerCase()] = true;
    });
    var key = SUGGESTION_FIELDS[listId];
    entriesCache.forEach(function (entry) {
      var value = String(entry[key] || "").trim();
      if (!value || seen[value.toLowerCase()]) return;
      var option = document.createElement("option");
      option.value = value;
      list.appendChild(option);
      seen[value.toLowerCase()] = true;
    });
  }
}

function fileIdentity(file) {
  return [file.name, file.size, file.lastModified].join("|");
}

function suggestedEvidenceType(file) {
  var name = String(file.name || "").toLowerCase();
  if (/medal|trophy|award/.test(name)) return "Medal / Trophy";
  if (/certificate|cert\b/.test(name) || file.type === "application/pdf") return "Certificate";
  return "Photo";
}

function isVideoFile(file) {
  return /^video\//i.test(file.type || "") || /\.(mp4|mov|avi|mkv|webm|m4v|wmv)$/i.test(file.name || "");
}

function isAllowedEvidenceFile(file) {
  return /^image\//i.test(file.type || "") || file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function syncOverallEvidenceType() {
  if (!pendingFiles.length) {
    setVal("#f-etype", baseEvidenceType);
    return;
  }
  var types = [];
  pendingFiles.forEach(function (item) {
    if (item.evidenceType && types.indexOf(item.evidenceType) < 0) types.push(item.evidenceType);
  });
  setVal("#f-etype", types.length === 1 ? types[0] : (types.length > 1 ? "Multiple evidence" : ""));
}

function renderPendingFiles() {
  var list = $("#pendingFileList");
  if (!list) return;
  if (!pendingFiles.length) {
    list.innerHTML = '<div class="pending-files-empty">No files attached yet.</div>';
    syncOverallEvidenceType();
    return;
  }
  list.innerHTML = pendingFiles.map(function (item) {
    var options = EVIDENCE_FILE_TYPES.map(function (type) {
      return '<option' + (item.evidenceType === type ? " selected" : "") + '>' + esc(type) + '</option>';
    }).join("");
    return '<div class="pending-file" data-file-id="' + item.id + '">' +
      '<div class="pending-file-info"><strong>' + esc(item.file.name) + '</strong>' +
      '<span class="muted small">' + esc(formatFileSize(item.file.size)) + '</span></div>' +
      '<label class="pending-file-type"><span>Type</span><select data-file-type="' + item.id + '">' + options + '</select></label>' +
      '<button type="button" class="mini danger" data-remove-file="' + item.id + '">Remove</button>' +
      '</div>';
  }).join("");
  syncOverallEvidenceType();
}

function addPendingFiles(files) {
  var rejectedVideo = 0, rejectedType = 0, duplicate = 0, added = 0;
  files.forEach(function (file) {
    if (isVideoFile(file)) { rejectedVideo++; return; }
    if (!isAllowedEvidenceFile(file)) { rejectedType++; return; }
    if (pendingFiles.some(function (item) { return fileIdentity(item.file) === fileIdentity(file); })) { duplicate++; return; }
    if (pendingFiles.length >= 5) return;
    pendingFiles.push({ id: pendingFileSequence++, file: file, evidenceType: suggestedEvidenceType(file) });
    added++;
  });
  renderPendingFiles();
  var messages = [];
  if (added) messages.push(added + " file" + (added === 1 ? "" : "s") + " added to the upload queue.");
  if (files.length > added && pendingFiles.length >= 5) messages.push("The queue is limited to 5 files.");
  if (rejectedVideo) messages.push("Video files were not added; use a video link instead.");
  if (rejectedType) messages.push("Only images and PDF files are accepted.");
  if (duplicate) messages.push("Duplicate files were skipped.");
  $("#fileSelectionHint").textContent = messages.join(" ") || "No new files were added.";
}

function profileFallback() {
  return (window.PORTFOLIO_CONFIG || {}).profile || {};
}

function profilePhotoUrl(url) {
  url = String(url || "");
  var match = url.match(/\/d\/([-\w]{15,})/) || url.match(/[?&]id=([-\w]{15,})/);
  return match ? "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w500" : url;
}

function savedProfileValue(profile, fallback, key, defaultValue) {
  return Object.prototype.hasOwnProperty.call(profile, key) ? profile[key] : (fallback[key] || defaultValue || "");
}

function renderProfileEditor(profile) {
  var fallback = profileFallback();
  profile = profile || {};
  setVal("#p-name", savedProfileValue(profile, fallback, "name", "Pingping"));
  setVal("#p-tagline", savedProfileValue(profile, fallback, "tagline", ""));
  setVal("#p-summary", savedProfileValue(profile, fallback, "summary", ""));
  setVal("#p-location", savedProfileValue(profile, fallback, "location", ""));
  var interests = Array.isArray(profile.interests) ? profile.interests : (fallback.interests || []);
  setVal("#p-interests", interests.join(", "));
  profileState.photo = savedProfileValue(profile, fallback, "photo", "assets/profile/profile.svg");
  profileState.file = null;
  if (profileState.previewUrl) URL.revokeObjectURL(profileState.previewUrl);
  profileState.previewUrl = "";
  $("#profilePhotoInput").value = "";
  $("#profilePreview").src = profilePhotoUrl(profileState.photo);
  $("#profilePhotoHint").textContent = "JPG, PNG, WebP, or GIF. Maximum 5 MB.";
}

function loadProfile() {
  setMsg($("#profileMsg"), "Loading profile…", "");
  callScript({ action: "getProfile", passcode: session.passcode })
    .then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || "Could not load profile");
      renderProfileEditor(res.profile || {});
      setMsg($("#profileMsg"), "", "");
    })
    .catch(function (error) {
      renderProfileEditor({});
      setMsg($("#profileMsg"), "Using the default profile: " + error.message, "err");
    });
}

function saveProfile() {
  var name = val("#p-name");
  if (!name) { setMsg($("#profileMsg"), "Display name is required.", "err"); return; }
  $("#saveProfileBtn").disabled = true;
  setMsg($("#profileMsg"), "Saving profile…", "");
  var photoPromise = profileState.file
    ? readFile({ file: profileState.file, evidenceType: "Profile photo" })
    : Promise.resolve(null);
  photoPromise.then(function (photoFile) {
    return callScript({
      action: "saveProfile",
      passcode: session.passcode,
      name: name,
      tagline: val("#p-tagline"),
      summary: val("#p-summary"),
      location: val("#p-location"),
      interests: val("#p-interests"),
      photo: profileState.photo,
      photoFile: photoFile
    });
  }).then(function (res) {
    $("#saveProfileBtn").disabled = false;
    if (!res || !res.ok) throw new Error((res && res.error) || "Could not save profile");
    renderProfileEditor(res.profile || {});
    setMsg($("#profileMsg"), "✓ Profile saved. Refresh View Portfolio to see the update.", "ok");
  }).catch(function (error) {
    $("#saveProfileBtn").disabled = false;
    setMsg($("#profileMsg"), "Could not save profile: " + error.message, "err");
  });
}

function setFilterOptions(id, firstLabel, values, selected) {
  var select = $(id);
  if (!select) return "";
  select.innerHTML = "";
  var first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.appendChild(first);
  values.forEach(function (value) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = values.indexOf(selected) >= 0 ? selected : "";
  return select.value;
}

function refreshListFilters() {
  var categories = [], years = [];
  entriesCache.forEach(function (entry) {
    var category = String(entry.category || "").trim();
    var year = String(entry.year || "").trim();
    if (category && categories.indexOf(category) < 0) categories.push(category);
    if (year && years.indexOf(year) < 0) years.push(year);
  });
  categories.sort(function (a, b) { return a.localeCompare(b); });
  years.sort(function (a, b) { return b.localeCompare(a, undefined, { numeric: true }); });
  listState.category = setFilterOptions("#listCategory", "All categories", categories, listState.category);
  listState.year = setFilterOptions("#listYear", "All years", years, listState.year);
}

function filteredEntries() {
  var query = listState.query.toLowerCase();
  return entriesCache.filter(function (entry) {
    if (listState.category && entry.category !== listState.category) return false;
    if (listState.year && String(entry.year || "") !== listState.year) return false;
    if (!query) return true;
    var searchable = [
      entry.recordId, entry.title, entry.year, entry.category, entry.level,
      entry.result, entry.rank, entry.organizer, entry.school, entry.grade,
      entry.role, entry.participationType, entry.notes
    ].join(" ").toLowerCase();
    return searchable.indexOf(query) >= 0;
  });
}

function showForm() {
  $("#loginCard").hidden = true;
  $("#profileCard").hidden = false;
  $("#formCard").hidden = false;
  $("#listCard").hidden = false;
  $("#who").textContent = session.user + (session.email ? " (" + session.email + ")" : "");
  loadProfile();
  loadList();
}

function doLogin() {
  var pass = val("#passcode");
  if (!pass) { setMsg($("#loginMsg"), "Please enter your passcode.", "err"); return; }
  if (!scriptUrl()) { $("#loginCard").hidden = true; $("#notConfigured").hidden = false; return; }
  setMsg($("#loginMsg"), "Checking…", "");
  callScript({ action: "verify", passcode: pass })
    .then(function (res) {
      if (res && res.ok) {
        session.passcode = pass; session.user = res.user; session.email = res.email || "";
        try {
          sessionStorage.setItem("pp_pass", pass);
          sessionStorage.setItem("pp_user", res.user);
          sessionStorage.setItem("pp_email", session.email);
        } catch (e) {}
        showForm();
      } else { setMsg($("#loginMsg"), (res && res.error) || "Invalid passcode.", "err"); }
    })
    .catch(function (e) { setMsg($("#loginMsg"), "Connection error: " + e, "err"); });
}

/* ----- list ----- */
function loadList() {
  $("#listMsg").textContent = "Loading…";
  callScript({ action: "list", passcode: session.passcode })
    .then(function (res) {
      if (!res || !res.ok) { $("#listMsg").textContent = "Could not load list: " + ((res && res.error) || "error"); return; }
      entriesCache = res.entries || [];
      refreshSuggestions();
      refreshListFilters();
      renderList();
    })
    .catch(function (e) { $("#listMsg").textContent = "Connection error: " + e; });
}

function esc(s) { return (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function renderList() {
  var box = $("#entryList");
  var pagination = $("#listPagination");
  $("#listTools").hidden = !entriesCache.length;
  if (!entriesCache.length) {
    $("#listMsg").textContent = "No achievements saved yet.";
    box.innerHTML = "";
    pagination.innerHTML = "";
    return;
  }

  var filtered = filteredEntries();
  var pageSize = listState.pageSize === "all" ? Math.max(filtered.length, 1) : Number(listState.pageSize) || 10;
  var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (listState.page > totalPages) listState.page = totalPages;
  var start = (listState.page - 1) * pageSize;
  var pageEntries = filtered.slice(start, start + pageSize);

  if (!filtered.length) {
    $("#listMsg").textContent = "No matches found (" + entriesCache.length + " saved in total).";
    box.innerHTML = '<div class="list-empty">Try another search or clear the filters.</div>';
    pagination.innerHTML = "";
    return;
  }

  $("#listMsg").textContent = "Showing " + (start + 1) + "–" + (start + pageEntries.length) + " of " + filtered.length +
    (filtered.length !== entriesCache.length ? " matches (" + entriesCache.length + " saved)" : " saved");
  box.innerHTML = pageEntries.map(function (e) {
    var sub = [e.year, e.category, e.level, e.result].filter(Boolean).join(" · ");
    return '<div class="entry-row">' +
      '<div class="entry-row-main"><strong>' + esc(e.title) + '</strong>' +
      '<span class="muted small">' + esc(e.recordId) + (sub ? " · " + esc(sub) : "") + '</span></div>' +
      '<div class="entry-row-actions">' +
        '<button class="mini" data-edit="' + esc(e.recordId) + '">Edit</button>' +
        '<button class="mini danger" data-del="' + esc(e.recordId) + '">Delete</button>' +
      '</div></div>';
  }).join("");
  box.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { startEdit(b.getAttribute("data-edit")); }); });
  box.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () { doDelete(b.getAttribute("data-del")); }); });

  if (listState.pageSize === "all" || totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  var pageButtons = [];
  for (var page = 1; page <= totalPages; page++) {
    if (page === 1 || page === totalPages || Math.abs(page - listState.page) <= 1) {
      pageButtons.push('<button type="button" class="page-btn' + (page === listState.page ? " active" : "") + '" data-page="' + page + '">' + page + '</button>');
    } else if (pageButtons[pageButtons.length - 1] !== '<span class="page-gap">…</span>') {
      pageButtons.push('<span class="page-gap">…</span>');
    }
  }
  pagination.innerHTML = '<button type="button" class="page-btn page-nav" data-page="' + (listState.page - 1) + '"' + (listState.page === 1 ? " disabled" : "") + '>Previous</button>' +
    pageButtons.join("") +
    '<button type="button" class="page-btn page-nav" data-page="' + (listState.page + 1) + '"' + (listState.page === totalPages ? " disabled" : "") + '>Next</button>';
  pagination.querySelectorAll("[data-page]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.disabled) return;
      listState.page = Number(button.getAttribute("data-page"));
      renderList();
      $("#listCard").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ----- edit ----- */
function startEdit(rid) {
  var e = entriesCache.filter(function (x) { return x.recordId === rid; })[0];
  if (!e) return;
  editingId = rid;
  pendingFiles = [];
  baseEvidenceType = e.evidenceType || "";
  populateYearOptions(e.year);
  for (var k in FIELD_IDS) setVal(FIELD_IDS[k], e[k]);
  if (!e.dadNote && e.parentNote) setVal("#f-dad-note", e.parentNote);
  var legacyCategory = e.category === "Math & Science";
  if (legacyCategory) setVal("#f-category", "");
  renderPendingFiles();
  renderSavedEvidence();
  $("#formTitle").textContent = "Edit achievement (" + rid + ")";
  $("#submitBtn").textContent = "Save changes";
  $("#cancelBtn").hidden = false;
  setMsg($("#formMsg"), legacyCategory
    ? "This older record used Math & Science. Please choose Math or Science before saving."
    : "Editing " + rid + ". Remove existing attachments individually or add new files.", "");
  try { var fc = $("#formCard"); if (fc.scrollIntoView) fc.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
}

function cancelEdit() {
  editingId = "";
  clearForm(true);
  $("#formTitle").textContent = "Add achievement";
  $("#submitBtn").textContent = "Save achievement";
  $("#cancelBtn").hidden = true;
  setMsg($("#formMsg"), "", "");
}

function doSubmit() {
  if (!val("#f-title")) { setMsg($("#formMsg"), "Activity / Competition Name is required.", "err"); return; }
  if (!val("#f-category")) { setMsg($("#formMsg"), "Category is required.", "err"); return; }
  if (!val("#f-year")) { setMsg($("#formMsg"), "Year is required.", "err"); return; }
  if (pendingFiles.length > 5) {
    setMsg($("#formMsg"), "Please select no more than 5 evidence files for one achievement.", "err");
    return;
  }
  if (pendingFiles.some(function (item) { return !item.evidenceType; })) {
    setMsg($("#formMsg"), "Please choose a type for every evidence file.", "err");
    return;
  }
  var updating = !!editingId;
  setMsg($("#formMsg"), (updating ? "Saving changes…" : "Saving…") + " uploading files may take a moment.", "");
  $("#submitBtn").disabled = true;

  Promise.all(pendingFiles.map(readFile))
    .then(function (files) {
      var payload = buildPayload(session.passcode, files);
      payload.action = updating ? "update" : "add";
      if (updating) payload.recordId = editingId;
      return callScript(payload);
    })
    .then(function (res) {
      $("#submitBtn").disabled = false;
      if (res && res.ok) {
        if (updating) { setMsg($("#formMsg"), "✓ Updated " + res.recordId + ".", "ok"); cancelEdit(); }
        else { setMsg($("#formMsg"), "✓ Saved as " + (res.recordId || "a new record") + "! You can add another.", "ok"); clearForm(false); }
        loadList();
      } else { setMsg($("#formMsg"), "Could not save: " + ((res && res.error) || "unknown error"), "err"); }
    })
    .catch(function (e) { $("#submitBtn").disabled = false; setMsg($("#formMsg"), "Connection error: " + e, "err"); });
}

function doDelete(rid) {
  if (!window.confirm("Delete " + rid + "? This removes the row from the sheet (uploaded files stay in Drive).")) return;
  setMsg($("#formMsg"), "Deleting " + rid + "…", "");
  callScript({ action: "delete", passcode: session.passcode, recordId: rid })
    .then(function (res) {
      if (res && res.ok) { setMsg($("#formMsg"), "✓ Deleted " + rid + ".", "ok"); if (editingId === rid) cancelEdit(); loadList(); }
      else { setMsg($("#formMsg"), "Could not delete: " + ((res && res.error) || "error"), "err"); }
    })
    .catch(function (e) { setMsg($("#formMsg"), "Connection error: " + e, "err"); });
}

function clearForm(keepCategory) {
  for (var k in FIELD_IDS) { if (keepCategory && k === "category") continue; setVal(FIELD_IDS[k], ""); }
  var f = $("#f-files"); if (f) f.value = "";
  pendingFiles = [];
  baseEvidenceType = "";
  populateYearOptions(new Date().getFullYear());
  renderPendingFiles();
  renderSavedEvidence();
  var hint = $("#fileSelectionHint");
  if (hint) hint.textContent = "Video files are not accepted. Add a YouTube or video link below instead.";
}

function doLogout() {
  session = { passcode: "", user: "", email: "" }; editingId = ""; entriesCache = [];
  try {
    sessionStorage.removeItem("pp_pass");
    sessionStorage.removeItem("pp_user");
    sessionStorage.removeItem("pp_email");
  } catch (e) {}
  $("#profileCard").hidden = true; $("#formCard").hidden = true; $("#listCard").hidden = true; $("#loginCard").hidden = false;
  $("#passcode").value = ""; setMsg($("#loginMsg"), "", "");
}

function initAdmin() {
  populateYearOptions(new Date().getFullYear());
  $("#loginBtn").addEventListener("click", doLogin);
  $("#passcode").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
  $("#submitBtn").addEventListener("click", doSubmit);
  $("#saveProfileBtn").addEventListener("click", saveProfile);
  $("#profilePhotoInput").addEventListener("change", function (e) {
    var file = (e.target.files || [])[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type || "")) {
      e.target.value = "";
      setMsg($("#profileMsg"), "Please choose a JPG, PNG, WebP, or GIF image.", "err");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      setMsg($("#profileMsg"), "Profile photo must be 5 MB or smaller.", "err");
      return;
    }
    profileState.file = file;
    if (profileState.previewUrl) URL.revokeObjectURL(profileState.previewUrl);
    profileState.previewUrl = URL.createObjectURL(file);
    $("#profilePreview").src = profileState.previewUrl;
    $("#profilePhotoHint").textContent = file.name + " selected. It will upload when you save the profile.";
    setMsg($("#profileMsg"), "", "");
  });
  $("#cancelBtn").addEventListener("click", function (e) { e.preventDefault(); cancelEdit(); });
  $("#logout").addEventListener("click", function (e) { e.preventDefault(); doLogout(); });
  $("#refreshList").addEventListener("click", function (e) { e.preventDefault(); loadList(); });
  $("#entrySearch").addEventListener("input", function (e) {
    listState.query = e.target.value.trim();
    listState.page = 1;
    renderList();
  });
  $("#listCategory").addEventListener("change", function (e) {
    listState.category = e.target.value;
    listState.page = 1;
    renderList();
  });
  $("#listYear").addEventListener("change", function (e) {
    listState.year = e.target.value;
    listState.page = 1;
    renderList();
  });
  $("#listPageSize").addEventListener("change", function (e) {
    listState.pageSize = e.target.value === "all" ? "all" : Number(e.target.value);
    listState.page = 1;
    renderList();
  });
  $("#clearListFilters").addEventListener("click", function () {
    listState.query = "";
    listState.category = "";
    listState.year = "";
    listState.page = 1;
    $("#entrySearch").value = "";
    $("#listCategory").value = "";
    $("#listYear").value = "";
    renderList();
  });
  $("#addFilesBtn").addEventListener("click", function () { $("#f-files").click(); });
  $("#f-files").addEventListener("change", function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    if (files.length) addPendingFiles(files);
    e.target.value = "";
  });
  $("#pendingFileList").addEventListener("change", function (e) {
    var id = Number(e.target.getAttribute("data-file-type"));
    if (!id) return;
    var item = pendingFiles.filter(function (candidate) { return candidate.id === id; })[0];
    if (item) item.evidenceType = e.target.value;
    syncOverallEvidenceType();
  });
  $("#pendingFileList").addEventListener("click", function (e) {
    var button = e.target.closest ? e.target.closest("[data-remove-file]") : null;
    if (!button) return;
    var id = Number(button.getAttribute("data-remove-file"));
    pendingFiles = pendingFiles.filter(function (item) { return item.id !== id; });
    renderPendingFiles();
    $("#fileSelectionHint").textContent = pendingFiles.length ? pendingFiles.length + " file(s) ready to upload." : "Video files are not accepted. Add a YouTube or video link below instead.";
  });
  $("#savedEvidenceList").addEventListener("click", function (e) {
    var button = e.target.closest ? e.target.closest("[data-remove-saved-evidence]") : null;
    if (!button) return;
    removeSavedEvidence(Number(button.getAttribute("data-remove-saved-evidence")));
  });
  $("#f-evlink").addEventListener("input", function () { if (editingId) renderSavedEvidence(); });
  renderPendingFiles();
  try {
    var p = sessionStorage.getItem("pp_pass"), u = sessionStorage.getItem("pp_user"), email = sessionStorage.getItem("pp_email");
    if (p && u) { session.passcode = p; session.user = u; session.email = email || ""; showForm(); }
  } catch (e) {}
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAdmin);
else initAdmin();
