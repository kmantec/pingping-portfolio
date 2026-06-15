/* ===================================================================
   Pingping Portfolio — CONFIG  (the only file you normally edit)
   See SETUP.md and AUTH_SETUP.md for instructions.
   =================================================================== */
window.PORTFOLIO_CONFIG = {

  // ---- LOGIN: Firebase Google Authentication (Spark plan / free) ---
  // Fill these values after creating a Firebase Web App. Firebase is
  // used only as a login gate; Sheet, Drive and Apps Script stay as-is.
  firebase: {
    apiKey: "AIzaSyA4HeBbchLyDjzdjAzeTrk9EuXX7IB5u1I",
    authDomain: "pingping-portfolio.firebaseapp.com",
    projectId: "pingping-portfolio",
    appId: "1:769351009890:web:515aa3962269875de6333b"
  },

  // Only these Firebase user IDs may enter the website. Copy each UID
  // from Firebase Console -> Authentication -> Users.
  allowedUids: [
    "V7H0qFyOwoePChyEG4ju5QYkWNl2", // Pingping
    "UB8EoJajoSXHsXQFyOzJVituP3G2", // Dad
    "xUPFfDuynPZx2SW1R57YL8fegOp1", // Mom
    "UyIHDYidW5e4XdOVpqKV8XtBiSH3"  // Pingping
  ],

  // ---- LIVE DATA: read the family Google Sheet as CSV --------------
  // Pre-filled for this project's sheet ("Pingping_Portfolio").
  // REQUIREMENT: the sheet must be shared "Anyone with the link -> Viewer"
  // (or File -> Share -> Publish to web). See SETUP.md.
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/11HwCxqYSK96hCXnqKzftd1dqphJ_t04VmVcY39Fwih8/gviz/tq?tqx=out:csv",

  // ---- ADMIN: the Apps Script Web App URL (ends with /exec) --------
  scriptUrl: "https://script.google.com/macros/s/AKfycbyLftlHpBwiFcnz8OPgnIwplI7jPPCbFGhRpVkU6Yt-BlOVAzaLqAj9P5FtkHcM8QNm/exec",

  // ---- PROFILE (top of the page) -----------------------------------
  profile: {
    name: "Pingping",
    tagline: "Student • Competitor • Lifelong Learner",
    summary: "A growing family collection of Pingping's competitions, awards, and proud moments from childhood to today — keeping her journey and memories together in one place.",
    photo: "assets/profile/profile.svg",
    location: "Bangkok, Thailand",
    email: "",
    interests: ["Mathematics", "Science", "Music", "Art"]
  }
};
