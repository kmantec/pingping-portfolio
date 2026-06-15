/* Public single-achievement view. No Firebase login is required. */
var $ = function (selector, root) { return (root || document).querySelector(selector); };
var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
var sharedEntry = null;

function esc(value) {
  return (value || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(value) {
  value = (value || "").toString().trim();
  if (!value || /^\d{4}$/.test(value)) return value;
  var date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00" : value);
  return isNaN(date) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function isYes(value) { return /^(y|yes|true|1|✓|core|use)/i.test((value || "").toString().trim()); }
function driveId(url) {
  var match = (url || "").match(/\/d\/([-\w]{15,})/) || (url || "").match(/[?&]id=([-\w]{15,})/);
  return match ? match[1] : null;
}
function youtubeId(url) {
  var match = (url || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([-\w]{6,})/);
  return match ? match[1] : null;
}
function normPhoto(url) {
  var id = driveId(url);
  return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w400" : (url || "");
}
function splitLinks(value) {
  return (value || "").split(/\n+|;\s*(?=https?:)|,\s*(?=https?:)/i).map(function (item) { return item.trim(); }).filter(Boolean);
}
function evidenceValue(value, fallbackLabel) {
  var named = String(value || "").trim().match(/^(.*?)\s*\|\s*(https?:\/\/.*)$/i);
  if (!named) return { url: String(value || "").trim(), label: fallbackLabel };
  return { url: named[2].trim(), label: named[1].trim().replace(/\.[a-z0-9]{2,5}$/i, "") || fallbackLabel };
}
function normAttachment(url, label) {
  var youtube = youtubeId(url);
  if (youtube) return {
    kind: "youtube", label: label || "Video", thumb: "https://i.ytimg.com/vi/" + youtube + "/mqdefault.jpg",
    view: "https://www.youtube.com/embed/" + youtube, open: "https://www.youtube.com/watch?v=" + youtube, download: ""
  };
  var id = driveId(url);
  if (id) return {
    kind: "drive", label: label || "Evidence", thumb: "https://drive.google.com/thumbnail?id=" + id + "&sz=w200",
    view: "https://drive.google.com/file/d/" + id + "/preview", open: "https://drive.google.com/file/d/" + id + "/view",
    download: "https://drive.google.com/uc?export=download&id=" + id
  };
  if (/\.pdf(?:$|[?#])/i.test(url)) return { kind: "pdf", label: label || "Document", thumb: "", view: url, open: url, download: url };
  if (/^https?:\/\//i.test(url)) return { kind: "image", label: label || "Photo", thumb: url, view: url, open: url, download: url };
  return null;
}

function attachmentsFor(entry) {
  var attachments = [];
  splitLinks(entry.evidenceLink).forEach(function (value) {
    var evidence = evidenceValue(value, entry.evidenceType || "Evidence");
    var attachment = normAttachment(evidence.url, evidence.label);
    if (attachment) attachments.push(attachment);
  });
  return attachments;
}

function renderProfile(profile) {
  var fallback = (window.PORTFOLIO_CONFIG || {}).profile || {};
  profile = Object.assign({}, fallback, profile || {});
  $("#shareProfileName").textContent = profile.name || "Pingping";
  var photo = $("#shareProfilePhoto");
  photo.src = normPhoto(profile.photo || fallback.photo || "assets/profile/profile.svg");
  photo.onerror = function () { photo.style.display = "none"; };
}

function attachmentButton(attachment, index) {
  var cls = attachment.kind === "image" ? "img" : (attachment.kind === "youtube" ? "vid" : "pdf");
  var tag = attachment.kind === "image" ? "IMG" : (attachment.kind === "youtube" ? "VID" : (attachment.kind === "drive" ? "DOC" : "PDF"));
  var thumb = attachment.thumb ? '<span class="att-thumb"><img src="' + esc(attachment.thumb) + '" alt="" loading="lazy" onerror="this.parentNode.style.display=\'none\'" /></span>' : "";
  return '<button class="att-btn' + (thumb ? " has-thumb" : "") + '" data-attachment="' + index + '">' + thumb +
    '<span class="ic ' + cls + '">' + tag + '</span><span>' + esc(attachment.label) + '</span></button>';
}

function renderEntry(entry) {
  sharedEntry = entry;
  sharedEntry.attachments = attachmentsFor(entry);
  document.title = entry.title + " — Pingping";
  var badges = [
    entry.result ? '<span class="badge result">' + esc(entry.result) + (entry.rank ? " · " + esc(entry.rank) : "") + '</span>' : "",
    entry.level ? '<span class="badge level">' + esc(entry.level) + '</span>' : "",
    entry.category ? '<span class="badge cat">' + esc(entry.category) + '</span>' : "",
    entry.grade ? '<span class="badge grade">' + esc(entry.grade) + (entry.age ? " · age " + esc(entry.age) : "") + '</span>' : "",
    isYes(entry.useUniversity) ? '<span class="badge uni">★ Featured</span>' : ""
  ].join("");
  var meta = [entry.school, entry.role ? "Role: " + entry.role : "", entry.participationType, entry.frequency, entry.duration].filter(Boolean);
  var attachmentHtml = sharedEntry.attachments.map(attachmentButton).join("");
  $("#shareEntry").innerHTML = '<article class="entry share-entry">' +
    '<div class="entry-top"><h2 class="entry-title">' + esc(entry.title) + '</h2><span class="entry-date">' + esc(fmtDate(entry.year)) + '</span></div>' +
    '<div class="badges">' + badges + '</div>' +
    (entry.organizer ? '<p class="entry-org">Organized by <strong>' + esc(entry.organizer) + '</strong></p>' : "") +
    (meta.length ? '<p class="entry-meta">' + meta.map(esc).join(" · ") + '</p>' : "") +
    (entry.notes ? '<p class="entry-desc">' + esc(entry.notes) + '</p>' : "") +
    (entry.reflection ? '<blockquote class="reflection"><span>Pingping’s memory</span>' + esc(entry.reflection) + '</blockquote>' : "") +
    ((entry.dadNote || entry.parentNote) ? '<p class="parent-note dad-note"><strong>Dad\'s memory:</strong> ' + esc(entry.dadNote || entry.parentNote) + '</p>' : "") +
    (entry.momNote ? '<p class="parent-note mom-note"><strong>Mom\'s memory:</strong> ' + esc(entry.momNote) + '</p>' : "") +
    (attachmentHtml ? '<div class="attachments">' + attachmentHtml + '</div>' : "") + '</article>';
  $("#shareStatus").hidden = true;
  $$("[data-attachment]").forEach(function (button) {
    button.addEventListener("click", function () { openViewer(Number(button.getAttribute("data-attachment"))); });
  });
}

function openViewer(index) {
  var attachment = sharedEntry.attachments[index];
  if (!attachment) return;
  $("#viewerTitle").textContent = sharedEntry.title;
  $("#viewerSub").textContent = (sharedEntry.organizer || "") + (sharedEntry.year ? " · " + fmtDate(sharedEntry.year) : "");
  $("#viewerTabs").innerHTML = sharedEntry.attachments.map(function (item, itemIndex) {
    return '<button class="vtab' + (itemIndex === index ? " active" : "") + '" data-view-index="' + itemIndex + '">' + esc(item.label || ("File " + (itemIndex + 1))) + '</button>';
  }).join("");
  $$("[data-view-index]").forEach(function (tab) { tab.addEventListener("click", function () { showAttachment(Number(tab.dataset.viewIndex)); }); });
  $("#viewer").hidden = false;
  document.body.style.overflow = "hidden";
  showAttachment(index);
}

function showAttachment(index) {
  var attachment = sharedEntry.attachments[index];
  if (!attachment) return;
  $$("[data-view-index]").forEach(function (tab, tabIndex) { tab.classList.toggle("active", tabIndex === index); });
  $("#viewerDownload").href = attachment.download || attachment.open || attachment.view;
  $("#viewerOpen").href = attachment.open || attachment.view;
  if (attachment.kind === "image") {
    $("#viewerBody").innerHTML = '<img src="' + esc(attachment.view) + '" alt="' + esc(attachment.label) + '" />';
  } else {
    $("#viewerBody").innerHTML = '<iframe src="' + esc(attachment.view) + '" title="' + esc(attachment.label) + '" allow="autoplay; fullscreen" allowfullscreen></iframe>' +
      '<div class="viewer-fallback">If the preview is blank, use <a href="' + esc(attachment.open || attachment.view) + '" target="_blank" rel="noopener">Open in tab</a>.</div>';
  }
}

function closeViewer() {
  $("#viewer").hidden = true;
  $("#viewerBody").innerHTML = "";
  document.body.style.overflow = "";
}

async function shareCurrentPage() {
  try {
    if (navigator.share && sharedEntry) {
      await navigator.share({ title: sharedEntry.title, text: "A shared achievement from Pingping's Portfolio", url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    var button = $("#copyShareLink");
    button.textContent = "Link copied";
    setTimeout(function () { button.textContent = "Share this page"; }, 1800);
  } catch (error) {
    if (error && error.name === "AbortError") return;
    window.prompt("Copy this share link:", window.location.href);
  }
}

async function init() {
  var id = new URLSearchParams(window.location.search).get("id");
  var config = window.PORTFOLIO_CONFIG || {};
  if (!id || !config.scriptUrl) {
    $("#shareStatus").textContent = "This share link is incomplete.";
    return;
  }
  try {
    var separator = config.scriptUrl.indexOf("?") >= 0 ? "&" : "?";
    var response = await fetch(config.scriptUrl + separator + "action=share&id=" + encodeURIComponent(id) + "&_=" + Date.now(), { cache: "no-store" });
    var result = await response.json();
    if (!result || !result.ok || !result.entry) throw new Error((result && result.error) || "Achievement not found");
    renderProfile(result.profile || {});
    renderEntry(result.entry);
  } catch (error) {
    $("#shareStatus").textContent = "This shared achievement could not be loaded. " + error.message;
  }
}

$("#copyShareLink").addEventListener("click", shareCurrentPage);
$$('[data-close]').forEach(function (element) { element.addEventListener("click", closeViewer); });
document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeViewer(); });
init();
