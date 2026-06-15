import {
  isAllowedUser,
  isAuthConfigured,
  loginWithGoogle,
  safeNextPage,
  signOutUser,
  waitForUser
} from "./auth.js";

var $ = function (selector) { return document.querySelector(selector); };

function profilePhotoUrl(url) {
  url = String(url || "").trim();
  var match = url.match(/\/d\/([-\w]{15,})/) || url.match(/[?&]id=([-\w]{15,})/);
  return match ? "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w200" : url;
}

async function loadLoginProfilePhoto() {
  var config = window.PORTFOLIO_CONFIG || {};
  var fallback = config.profile || {};
  var photoUrl = fallback.photo || "";
  try {
    if (config.scriptUrl) {
      var separator = config.scriptUrl.indexOf("?") >= 0 ? "&" : "?";
      var response = await fetch(config.scriptUrl + separator + "action=profile&_=" + Date.now(), { cache: "no-store" });
      var result = await response.json();
      if (result && result.ok && result.profile && result.profile.photo) photoUrl = result.profile.photo;
    }
  } catch (error) {
    // The P remains visible when the saved profile cannot be reached.
  }
  if (!photoUrl) return;
  var image = $("#loginProfilePhoto");
  var fallbackMark = $("#loginProfileFallback");
  image.onload = function () {
    image.hidden = false;
    fallbackMark.hidden = true;
  };
  image.onerror = function () {
    image.hidden = true;
    fallbackMark.hidden = false;
  };
  image.src = profilePhotoUrl(photoUrl);
}

function friendlyError(error) {
  var code = error && error.code || "";
  if (code === "auth/not-allowed") return "This account is not authorized for the family portfolio.";
  if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow pop-ups and try again.";
  if (code === "auth/cancelled-popup-request") return "Another sign-in window is already open.";
  if (code === "auth/account-exists-with-different-credential") return "This email is already linked to another sign-in method.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait and try again.";
  if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
  return error && error.message || "Unable to sign in.";
}

async function init() {
  loadLoginProfilePhoto();
  if (!isAuthConfigured()) {
    $("#setupRequired").hidden = false;
    $("#loginBtn").disabled = true;
    return;
  }

  var existing = await waitForUser();
  if (existing && isAllowedUser(existing)) {
    window.location.replace(safeNextPage());
    return;
  }
  if (existing) await signOutUser();

  if (new URLSearchParams(window.location.search).get("error") === "unauthorized") {
    $("#loginMsg").className = "form-msg err";
    $("#loginMsg").textContent = "This account is not authorized for the family portfolio.";
  }

  $("#loginBtn").addEventListener("click", async function () {
    var button = $("#loginBtn");
    var message = $("#loginMsg");
    button.disabled = true;
    message.className = "form-msg";
    message.textContent = "Signing in...";
    try {
      await loginWithGoogle();
      window.location.replace(safeNextPage());
    } catch (error) {
      button.disabled = false;
      message.className = "form-msg err";
      message.textContent = friendlyError(error);
    }
  });
}

init();
