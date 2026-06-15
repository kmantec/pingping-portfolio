/* Pingping Portfolio — public view
   Reads the family Google Sheet (published/shared as CSV) configured in
   data/config.js (sheetCsvUrl). Falls back to data/portfolio.js sample.
   Sheet columns (24): Record ID, Year, Age, Grade, School, Category,
   Activity / Competition Name, Organizer, Level, Result / Award,
   Score / Rank, Participation Type, Frequency, Duration, Role,
   Evidence Type, Evidence Link (Drive / YouTube), Student Reflection,
   Dad's Memory, Mom's Memory, Importance Level, Use for University, Notes,
   Last Edited By.
   Evidence links may be Google Drive or YouTube; shown live in-page. */

var CATEGORIES = [
  { id: "math",     label: "Math" },
  { id: "science",  label: "Science" },
  { id: "language", label: "Language" },
  { id: "arts",     label: "Arts & Music" },
  { id: "other",    label: "Other" }
];

var state = { data: null, category: "all", level: "all", uni: "all", time: "all", query: "", page: 1, pageSize: 10 };

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

function fmtDate(v) {
  v = (v || "").toString().trim();
  if (!v) return "";
  if (/^\d{4}$/.test(v)) return v;                       // year only
  var iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T00:00:00" : v;
  var d = new Date(iso);
  if (isNaN(d)) return v;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function yearValue(v) {
  v = (v || "").toString();
  var m = v.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}
function isYes(v) { return /^(y|yes|true|1|✓|core|use)/i.test((v || "").toString().trim()); }

/* ---------- normalization ---------- */
function normCategory(v) {
  v = (v || "").toString().trim().toLowerCase();
  if (!v) return "other";
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (v === CATEGORIES[i].id || v === CATEGORIES[i].label.toLowerCase()) return CATEGORIES[i].id;
  }
  if (v === "math & science") return "math"; // legacy records were predominantly mathematics
  if (/math|algebra|geometry|number theory/.test(v)) return "math";
  if (/science|sci|stem|coding|robot/.test(v)) return "science";
  if (/lang|english|speak|writ|debate|spell/.test(v)) return "language";
  if (/art|music|piano|draw|paint|danc|sing|choir/.test(v)) return "arts";
  return "other";
}

function driveId(u) {
  u = u || "";
  var m = u.match(/\/d\/([-\w]{15,})/) || u.match(/[?&]id=([-\w]{15,})/) || u.match(/\/file\/d\/([-\w]{15,})/);
  return m ? m[1] : null;
}
function youtubeId(u) {
  var m = (u || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([-\w]{6,})/);
  return m ? m[1] : null;
}
function normPhoto(u) {
  var id = driveId(u || "");
  return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w400" : (u || "");
}

function normAtt(url, label) {
  url = (url || "").toString().trim();
  if (!url) return null;
  var yt = youtubeId(url);
  if (yt) {
    return { kind: "youtube",
      view: "https://www.youtube.com/embed/" + yt,
      open: "https://www.youtube.com/watch?v=" + yt,
      download: "", thumb: "https://i.ytimg.com/vi/" + yt + "/mqdefault.jpg", label: label || "Video" };
  }
  var id = driveId(url);
  if (id) {
    return { kind: "drive",
      view: "https://drive.google.com/file/d/" + id + "/preview",
      open: "https://drive.google.com/file/d/" + id + "/view",
      download: "https://drive.google.com/uc?export=download&id=" + id,
      thumb: "https://drive.google.com/thumbnail?id=" + id + "&sz=w200",
      label: label || "Certificate" };
  }
  if (url.toLowerCase().indexOf(".pdf") > -1) {
    return { kind: "pdf", view: url, open: url, download: url, thumb: "", label: label || "Document (PDF)" };
  }
  if (/^https?:\/\//i.test(url)) {
    return { kind: "image", view: url, open: url, download: url, thumb: url, label: label || "Certificate" };
  }
  return null;
}

function splitLinks(cell) {
  return (cell || "").split(/\n+|;\s*(?=https?:)|,\s*(?=https?:)/i).map(function (s) { return s.trim(); }).filter(Boolean);
}

function evidenceValue(value, fallbackLabel) {
  value = (value || "").toString().trim();
  var named = value.match(/^(.*?)\s*\|\s*(https?:\/\/.*)$/i);
  if (!named) return { url: value, label: fallbackLabel };
  var label = named[1].trim().replace(/\.[a-z0-9]{2,5}$/i, "");
  return { url: named[2].trim(), label: label || fallbackLabel };
}

function cardEvidenceLabel(label, kind) {
  var text = String(label || "").trim().toLowerCase();
  var types = ["Medal / Trophy", "Certificate", "Report Card", "Photo", "Document"];
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
    var lowerType = type.toLowerCase();
    if (text === lowerType || text.indexOf(lowerType + " -") === 0) return type;
  }
  if (kind === "youtube") return "Video";
  if (kind === "image") return "Photo";
  return "Document";
}

function normalizeEntry(e) {
  e.category = normCategory(e.category);
  if (Array.isArray(e.attachments)) {
    e.attachments = e.attachments.map(function (a) {
      if (!a) return null;
      if (typeof a === "string") return normAtt(a, e.evidenceType);
      if (a.view) return a;
      return { kind: a.type === "pdf" ? "pdf" : "image", view: a.file, open: a.file, download: a.file, label: a.label || "Certificate" };
    }).filter(Boolean);
  } else {
    e.attachments = [];
  }
  return e;
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  var rows = [], row = [], field = "", inQ = false, i = 0, c;
  text = text.replace(/^﻿/, "");
  while (i < text.length) {
    c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
    i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function findCol(header, eqs, hass) {
  var i, j;
  for (i = 0; i < header.length; i++) for (j = 0; j < eqs.length; j++) if (header[i] === eqs[j]) return i;
  if (hass) for (i = 0; i < header.length; i++) for (j = 0; j < hass.length; j++) if (header[i].indexOf(hass[j]) >= 0) return i;
  return -1;
}

function rowsToEntries(rows) {
  if (!rows.length) return [];
  var header = rows[0].map(function (h) { return (h || "").trim().toLowerCase(); });
  var c = {
    recordId: findCol(header, ["record id", "id"], ["record id"]),
    title:    findCol(header, ["title", "activity / competition name", "activity", "name"], ["activity", "competition"]),
    year:     findCol(header, ["year", "date"], ["year", "date"]),
    age:      findCol(header, ["age"], ["age"]),
    grade:    findCol(header, ["grade"], ["grade"]),
    school:   findCol(header, ["school"], ["school"]),
    category: findCol(header, ["category"], ["category"]),
    organizer:findCol(header, ["organizer", "organiser"], ["organiz", "organis"]),
    level:    findCol(header, ["level"], []),
    result:   findCol(header, ["result / award", "result", "award"], ["result", "award"]),
    rank:     findCol(header, ["score / rank", "score", "rank"], ["score", "rank"]),
    ptype:    findCol(header, ["participation type"], ["participation"]),
    freq:     findCol(header, ["frequency"], ["frequency"]),
    duration: findCol(header, ["duration"], ["duration"]),
    role:     findCol(header, ["role"], []),
    etype:    findCol(header, ["evidence type"], ["evidence type"]),
    evidence: findCol(header, ["evidence link (drive / youtube)", "evidence link", "evidence"], ["evidence link", "link", "evidence"]),
    reflection:findCol(header, ["student reflection", "reflection"], ["reflection"]),
    dad:      findCol(header, ["dad's memory", "dad memory", "dad's note", "dad note"], ["dad"]),
    mom:      findCol(header, ["mom's memory", "mom memory", "mom's note", "mom note"], ["mom"]),
    parent:   findCol(header, ["parent note"], ["parent"]),
    importance:findCol(header, ["importance level", "importance"], ["importance"]),
    uni:      findCol(header, ["use for university"], ["university"]),
    notes:    findCol(header, ["notes"], ["notes", "note"]),
    editor:   findCol(header, ["last edited by", "edited by"], ["last edited", "edited by"])
  };
  var out = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r]; if (!row) continue;
    var g = function (k) { return c[k] >= 0 ? (row[c[k]] || "").trim() : ""; };
    var title = g("title"); if (!title) continue;
    var atts = [];
    splitLinks(g("evidence")).forEach(function (value) {
      var evidence = evidenceValue(value, g("etype"));
      var a = normAtt(evidence.url, evidence.label);
      if (a) atts.push(a);
    });
    out.push({
      recordId: g("recordId"), title: title, category: g("category"), level: g("level"),
      date: g("year"), organizer: g("organizer"),
      result: g("result"), rank: g("rank"),
      grade: g("grade"), ageAtEvent: g("age"), school: g("school"),
      ptype: g("ptype"), frequency: g("freq"), duration: g("duration"), role: g("role"),
      evidenceType: g("etype"), reflection: g("reflection"),
      dadNote: g("dad") || g("parent"), momNote: g("mom"),
      importance: g("importance"), useUni: g("uni"), description: g("notes"),
      lastEditedBy: g("editor"),
      attachments: atts
    });
  }
  return out;
}

/* ---------- load ---------- */
async function loadEntries() {
  var cfg = window.PORTFOLIO_CONFIG || {};
  var sample = (window.PORTFOLIO_DATA || {}).entries || [];
  if (cfg.sheetCsvUrl) {
    try {
      var res = await fetch(cfg.sheetCsvUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var entries = rowsToEntries(parseCSV(await res.text()));
      if (entries.length) return { entries: entries, source: "sheet" };
      return { entries: sample, source: "empty" };
    } catch (e) {
      console.error("Could not load Google Sheet, using sample data.", e);
      return { entries: sample, source: "error" };
    }
  }
  return { entries: sample, source: "sample" };
}

async function loadProfile() {
  var cfg = window.PORTFOLIO_CONFIG || {};
  var fallback = cfg.profile || (window.PORTFOLIO_DATA || {}).profile || { name: "Portfolio" };
  if (!cfg.scriptUrl) return fallback;
  try {
    var separator = cfg.scriptUrl.indexOf("?") >= 0 ? "&" : "?";
    var response = await fetch(cfg.scriptUrl + separator + "action=profile&_=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    var result = await response.json();
    var saved = result && result.ok && result.profile ? result.profile : {};
    var profile = Object.assign({}, fallback, saved);
    if (Object.prototype.hasOwnProperty.call(saved, "interests")) profile.interests = saved.interests;
    return profile;
  } catch (error) {
    console.error("Could not load the saved mini profile, using config defaults.", error);
    return fallback;
  }
}

async function init() {
  var cfg = window.PORTFOLIO_CONFIG || {};
  var results = await Promise.all([loadEntries(), loadProfile()]);
  var loaded = results[0];
  state.data = {
    profile: results[1],
    categories: CATEGORIES,
    entries: loaded.entries.map(normalizeEntry)
  };
  renderProfile();
  renderStats();
  renderFilters();
  bindControls();
  render();
  if (loaded.source === "error") showNotice("Could not load the Google Sheet — showing sample data. Make sure the sheet is shared “Anyone with the link”.");
  if (loaded.source === "empty") showNotice("Connected to the sheet, but no achievements yet. Add one from the Family Login page.");
}

function showNotice(msg) {
  var n = document.createElement("div");
  n.className = "notice"; n.textContent = msg;
  document.querySelector("main").prepend(n);
}

/* ---------- render ---------- */
function renderProfile() {
  var p = state.data.profile;
  document.title = (p.name || "Portfolio") + " — Portfolio";
  $("#profileName").textContent = p.name || "Portfolio";
  $("#profileTagline").textContent = p.tagline || "";
  $("#profileSummary").textContent = p.summary || "";
  $("#footerName").textContent = (p.fullName || p.name || "") + " — Achievement Portfolio";
  var photo = $("#profilePhoto");
  var src = normPhoto(p.photo);
  if (src) photo.src = src; else photo.style.display = "none";
  photo.onerror = function () { photo.style.visibility = "hidden"; };
  var meta = $("#profileMeta"); meta.innerHTML = "";
  var items = [];
  if (p.location) items.push(p.location);
  if (p.email) items.push(p.email);
  (p.interests || []).forEach(function (i) { items.push(i); });
  items.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; meta.appendChild(li); });
}

function renderStats() {
  var entries = state.data.entries || [];
  var golds = entries.filter(function (e) { return /gold|champion|1st|first|winner/i.test((e.result || "") + (e.rank || "")); }).length;
  var intl = entries.filter(function (e) { return /international|national/i.test(e.level || ""); }).length;
  var uni = entries.filter(function (e) { return isYes(e.useUni); }).length;
  var years = entries.map(function (e) { return yearValue(e.date); }).filter(function (y) { return y > 1900; });
  var span = years.length ? (Math.max.apply(null, years) - Math.min.apply(null, years) + 1) : 0;
  var stats = [
    { num: entries.length, label: "Total Achievements" },
    { num: golds, label: "Top / Gold Honors" },
    { num: uni || intl, label: uni ? "Featured Highlights" : "National & International" },
    { num: span, label: "Years Documented" }
  ];
  $("#statsGrid").innerHTML = stats.map(function (s) {
    return '<div class="stat"><div class="num">' + s.num + '</div><div class="label">' + s.label + '</div></div>';
  }).join("");
}

function renderFilters() {
  var present = {}; (state.data.entries || []).forEach(function (e) { present[e.category] = true; });
  var cats = CATEGORIES.filter(function (cc) { return present[cc.id]; });
  $("#categoryFilters").innerHTML = chip("all", "All Categories", "category", true) +
    cats.map(function (cc) { return chip(cc.id, cc.label, "category", false); }).join("");

  var levels = [];
  (state.data.entries || []).forEach(function (e) { if (e.level && levels.indexOf(e.level) < 0) levels.push(e.level); });
  var order = ["International", "National", "Regional", "Provincial", "School"];
  levels.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
  var anyUni = (state.data.entries || []).some(function (e) { return isYes(e.useUni); });
  var lvlWrap = $("#levelFilters");
  var html = "";
  if (levels.length) html += chip("all", "All Levels", "level", true) + levels.map(function (l) { return chip(l, l, "level", false); }).join("");
  lvlWrap.innerHTML = html;
  lvlWrap.style.display = levels.length ? "" : "none";

  var uniWrap = $("#uniFilters");
  if (uniWrap) {
    if (anyUni) { uniWrap.style.display = ""; uniWrap.innerHTML = chip("all", "All", "uni", true) + chip("yes", "★ Featured only", "uni", false); }
    else { uniWrap.style.display = "none"; uniWrap.innerHTML = ""; }
  }

  $("#timeFilters").innerHTML =
    chip("all", "All time", "time", true) +
    chip("1", "This year", "time", false) +
    chip("3", "Last 3 years", "time", false) +
    chip("5", "Last 5 years", "time", false);
}

function chip(value, label, group, active) {
  return '<button class="chip' + (active ? " active" : "") + '" data-group="' + group + '" data-value="' + value + '">' + label + '</button>';
}

function bindControls() {
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest ? ev.target.closest(".chip") : null;
    if (!t) return;
    var group = t.dataset.group;
    $$('.chip[data-group="' + group + '"]').forEach(function (x) { x.classList.remove("active"); });
    t.classList.add("active");
    state[group] = t.dataset.value;
    state.page = 1;
    render();
  });
  $("#searchInput").addEventListener("input", function (e) {
    state.query = e.target.value.toLowerCase().trim();
    state.page = 1;
    render();
  });
  $$("[data-close]").forEach(function (el) { el.addEventListener("click", closeViewer); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeViewer(); });
}

function catLabel(id) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i].label; return id; }

function visibleEntries() {
  var list = (state.data.entries || []).slice();
  list.sort(function (a, b) { return yearValue(b.date) - yearValue(a.date); });
  return list.filter(function (e) {
    if (state.category !== "all" && e.category !== state.category) return false;
    if (state.level !== "all" && e.level !== state.level) return false;
    if (state.uni === "yes" && !isYes(e.useUni)) return false;
    if (state.time !== "all") {
      var entryYear = yearValue(e.date);
      var currentYear = new Date().getFullYear();
      var range = parseInt(state.time, 10);
      if (!entryYear || entryYear < currentYear - range + 1 || entryYear > currentYear) return false;
    }
    if (state.query) {
      var hay = [e.date, e.title, e.organizer, e.result, e.rank, e.description, e.reflection, e.dadNote, e.momNote, e.parentNote, e.school, e.role, catLabel(e.category)].join(" ").toLowerCase();
      if (hay.indexOf(state.query) < 0) return false;
    }
    return true;
  });
}

var rendered = [];
function render() {
  rendered = [];
  var list = visibleEntries();
  var totalPages = Math.max(1, Math.ceil(list.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  var start = (state.page - 1) * state.pageSize;
  var pageEntries = list.slice(start, start + state.pageSize);
  $("#emptyState").hidden = list.length > 0;
  $("#resultCount").textContent = list.length
    ? "Showing " + (start + 1) + "–" + (start + pageEntries.length) + " of " + list.length + " achievement" + (list.length === 1 ? "" : "s")
    : "0 achievements";
  $("#timeline").innerHTML = pageEntries.map(entryHTML).join("");
  $$(".att-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { openViewer(parseInt(btn.dataset.e, 10), parseInt(btn.dataset.i, 10)); });
  });
  $$("[data-share-entry]").forEach(function (btn) {
    btn.addEventListener("click", function () { shareAchievement(parseInt(btn.dataset.shareEntry, 10), btn); });
  });
  renderPortfolioPagination(totalPages);
}

function renderPortfolioPagination(totalPages) {
  var pagination = $("#portfolioPagination");
  if (totalPages <= 1) { pagination.innerHTML = ""; return; }
  var buttons = [];
  for (var page = 1; page <= totalPages; page++) {
    if (page === 1 || page === totalPages || Math.abs(page - state.page) <= 1) {
      buttons.push('<button type="button" class="page-btn' + (page === state.page ? " active" : "") + '" data-portfolio-page="' + page + '">' + page + '</button>');
    } else if (buttons[buttons.length - 1] !== '<span class="page-gap">…</span>') {
      buttons.push('<span class="page-gap">…</span>');
    }
  }
  pagination.innerHTML = '<button type="button" class="page-btn page-nav" data-portfolio-page="' + (state.page - 1) + '"' + (state.page === 1 ? " disabled" : "") + '>Previous</button>' +
    buttons.join("") +
    '<button type="button" class="page-btn page-nav" data-portfolio-page="' + (state.page + 1) + '"' + (state.page === totalPages ? " disabled" : "") + '>Next</button>';
  $$('[data-portfolio-page]', pagination).forEach(function (button) {
    button.addEventListener("click", function () {
      if (button.disabled) return;
      state.page = parseInt(button.dataset.portfolioPage, 10);
      render();
      $(".controls").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function esc(s) { return (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function shareUrl(recordId) {
  var url = new URL("share.html", window.location.href);
  url.searchParams.set("id", recordId);
  return url.href;
}

async function shareAchievement(index, button) {
  var entry = rendered[index];
  if (!entry || !entry.recordId) return;
  var url = shareUrl(entry.recordId);
  try {
    if (navigator.share) {
      await navigator.share({ title: entry.title, text: "A shared achievement from Pingping's Portfolio", url: url });
      return;
    }
    await navigator.clipboard.writeText(url);
    var original = button.textContent;
    button.textContent = "Link copied";
    setTimeout(function () { button.textContent = original; }, 1800);
  } catch (error) {
    if (error && error.name === "AbortError") return;
    window.prompt("Copy this share link:", url);
  }
}

function entryHTML(e) {
  var ei = rendered.length; rendered.push(e);
  var badges = [
    e.result ? '<span class="badge result">' + esc(e.result) + (e.rank ? " · " + esc(e.rank) : "") + '</span>' : (e.rank ? '<span class="badge result">' + esc(e.rank) + '</span>' : ""),
    e.level ? '<span class="badge level">' + esc(e.level) + '</span>' : "",
    '<span class="badge cat">' + esc(catLabel(e.category)) + '</span>',
    e.grade ? '<span class="badge grade">' + esc(e.grade) + (e.ageAtEvent ? " · age " + esc(e.ageAtEvent) : "") + '</span>' : "",
    isYes(e.useUni) ? '<span class="badge uni">★ Featured</span>' : ""
  ].join("");

  var metaBits = [];
  if (e.school) metaBits.push(esc(e.school));
  if (e.role) metaBits.push("Role: " + esc(e.role));
  if (e.ptype) metaBits.push(esc(e.ptype));
  if (e.frequency) metaBits.push(esc(e.frequency));
  if (e.duration) metaBits.push(esc(e.duration));
  var meta = metaBits.length ? '<p class="entry-meta">' + metaBits.join(" · ") + '</p>' : "";

  var atts = (e.attachments || []).map(function (a, i) {
    var cls = a.kind === "image" ? "img" : (a.kind === "youtube" ? "vid" : "pdf");
    var tag = a.kind === "image" ? "IMG" : (a.kind === "youtube" ? "VID" : (a.kind === "drive" ? "DOC" : "PDF"));
    var thumb = a.thumb ? '<span class="att-thumb"><img src="' + esc(a.thumb) + '" alt="" loading="lazy" onerror="this.parentNode.style.display=\'none\'" /></span>' : "";
    return '<button class="att-btn' + (thumb ? " has-thumb" : "") + '" data-e="' + ei + '" data-i="' + i + '">' + thumb + '<span class="ic ' + cls + '">' + tag + '</span><span>' + esc(cardEvidenceLabel(a.label, a.kind)) + '</span></button>';
  }).join("");
  var share = e.recordId ? '<button class="att-btn share-entry-btn" type="button" data-share-entry="' + ei + '"><span class="share-symbol">↗</span><span>Share</span></button>' : "";

  return '<article class="entry lvl-' + esc(e.level || "x") + '">' +
    '<div class="entry-top"><h3 class="entry-title">' + esc(e.title) + '</h3>' +
    '<span class="entry-date">' + esc(fmtDate(e.date)) + '</span></div>' +
    '<div class="badges">' + badges + '</div>' +
    (e.organizer ? '<p class="entry-org">Organized by <strong>' + esc(e.organizer) + '</strong></p>' : "") +
    meta +
    (e.description ? '<p class="entry-desc">' + esc(e.description) + '</p>' : "") +
    (e.reflection ? '<blockquote class="reflection"><span>Pingping’s memory</span>' + esc(e.reflection) + '</blockquote>' : "") +
    ((e.dadNote || e.parentNote) ? '<p class="parent-note dad-note"><strong>Dad\'s memory:</strong> ' + esc(e.dadNote || e.parentNote) + '</p>' : "") +
    (e.momNote ? '<p class="parent-note mom-note"><strong>Mom\'s memory:</strong> ' + esc(e.momNote) + '</p>' : "") +
    (e.lastEditedBy ? '<p class="entry-audit">Last edited by ' + esc(e.lastEditedBy) + '</p>' : "") +
    ((atts || share) ? '<div class="attachments">' + atts + share + '</div>' : "") +
    '</article>';
}

/* ---------- viewer ---------- */
var viewerEntry = null;
function openViewer(ei, idx) {
  var entry = rendered[ei]; if (!entry) return;
  viewerEntry = entry;
  $("#viewerTitle").textContent = entry.title;
  $("#viewerSub").textContent = (entry.organizer || "") + (entry.date ? " · " + fmtDate(entry.date) : "");
  var tabs = $("#viewerTabs");
  tabs.innerHTML = (entry.attachments || []).map(function (a, i) {
    return '<button class="vtab' + (i === idx ? " active" : "") + '" data-i="' + i + '">' + esc(a.label || ("File " + (i + 1))) + '</button>';
  }).join("");
  $$(".vtab", tabs).forEach(function (t) { t.addEventListener("click", function () { showAttachment(parseInt(t.dataset.i, 10)); }); });
  $("#viewer").hidden = false;
  document.body.style.overflow = "hidden";
  showAttachment(idx);
}
function showAttachment(i) {
  var a = (viewerEntry.attachments || [])[i]; if (!a) return;
  $$(".vtab").forEach(function (t, j) { t.classList.toggle("active", j === i); });
  var dl = a.download || a.open || a.view;
  $("#viewerDownload").href = dl;
  $("#viewerOpen").href = a.open || a.view;
  var body = $("#viewerBody");
  if (a.kind === "image") {
    body.innerHTML = '<img src="' + a.view + '" alt="' + esc(a.label || "Certificate") + '" />';
  } else {
    body.innerHTML = '<iframe src="' + a.view + '" title="' + esc(a.label || "Evidence") + '" allow="autoplay; fullscreen" allowfullscreen></iframe>' +
      '<div class="viewer-fallback">If the preview is blank, use <a href="' + (a.open || a.view) + '" target="_blank" rel="noopener">Open in tab</a>' +
      (a.download ? ' or <a href="' + a.download + '" target="_blank" rel="noopener">Download</a>' : "") + '.</div>';
  }
}
function closeViewer() {
  var v = $("#viewer"); if (v.hidden) return;
  v.hidden = true; $("#viewerBody").innerHTML = ""; document.body.style.overflow = "";
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
