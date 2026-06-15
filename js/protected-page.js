import { requireAuthorizedUser, signOutUser } from "./auth.js";

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = function () { reject(new Error("Could not load " + src)); };
    document.body.appendChild(script);
  });
}

async function start() {
  var gate = document.querySelector("#authGate");
  try {
    var user = await requireAuthorizedUser();
    window.getPortfolioAuth = async function () {
      return {
        uid: user.uid,
        email: user.email || "",
        idToken: await user.getIdToken()
      };
    };
    var userLabel = document.querySelector("#firebaseUser");
    if (userLabel) userLabel.textContent = user.email || "Family member";

    var scripts = String(document.body.dataset.protectedScripts || "")
      .split(",")
      .map(function (src) { return src.trim(); })
      .filter(Boolean);
    for (var i = 0; i < scripts.length; i++) await loadScript(scripts[i]);

    document.documentElement.classList.add("authenticated");
    if (gate) gate.remove();

    var signOutButton = document.querySelector("#firebaseSignOut");
    if (signOutButton) {
      signOutButton.addEventListener("click", async function () {
        await signOutUser();
        window.location.replace("login.html");
      });
    }
  } catch (error) {
    if (gate && /not configured/i.test(error.message || "")) {
      gate.innerHTML = '<div><strong>Login setup is incomplete.</strong><br><span>' + error.message + '</span></div>';
    }
  }
}

start();
