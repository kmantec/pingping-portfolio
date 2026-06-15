import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

var config = window.PORTFOLIO_CONFIG || {};
var firebaseConfig = config.firebase || {};
var allowedUids = (config.allowedUids || [])
  .map(function (uid) { return String(uid || "").trim(); })
  .filter(Boolean);

export function isAuthConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    allowedUids.length
  );
}

var app = isAuthConfigured() ? initializeApp(firebaseConfig) : null;
var auth = app ? getAuth(app) : null;
var googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function isAllowedUser(user) {
  return Boolean(user && allowedUids.indexOf(user.uid) >= 0);
}

export function waitForUser() {
  if (!auth) return Promise.resolve(null);
  return new Promise(function (resolve) {
    var unsubscribe = onAuthStateChanged(auth, function (user) {
      unsubscribe();
      resolve(user || null);
    });
  });
}

export async function requireAuthorizedUser() {
  if (!isAuthConfigured()) {
    throw new Error("Firebase Authentication is not configured. Complete AUTH_SETUP.md first.");
  }

  var user = await waitForUser();
  if (!user) {
    redirectToLogin();
    throw new Error("Authentication required.");
  }
  if (!isAllowedUser(user)) {
    await signOut(auth);
    redirectToLogin("unauthorized");
    throw new Error("This account is not allowed.");
  }
  return user;
}

export async function loginWithGoogle() {
  if (!auth) throw new Error("Firebase Authentication is not configured.");
  await setPersistence(auth, browserLocalPersistence);
  var result = await signInWithPopup(auth, googleProvider);
  if (!isAllowedUser(result.user)) {
    await signOut(auth);
    var error = new Error("This account is not allowed.");
    error.code = "auth/not-allowed";
    throw error;
  }
  return result.user;
}

export function signOutUser() {
  return auth ? signOut(auth) : Promise.resolve();
}

export function safeNextPage() {
  var requested = new URLSearchParams(window.location.search).get("next") || "index.html";
  return /^(?:index|admin)\.html(?:[?#].*)?$/i.test(requested) ? requested : "index.html";
}

export function redirectToLogin(errorCode) {
  var current = (window.location.pathname.split("/").pop() || "index.html") + window.location.search + window.location.hash;
  var params = new URLSearchParams({ next: current });
  if (errorCode) params.set("error", errorCode);
  window.location.replace("login.html?" + params.toString());
}
