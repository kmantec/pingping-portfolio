# Pingping - Achievement Portfolio

A private family portfolio that records Pingping's competitions, awards, certificates, memories, and proud moments from childhood onward. Images and PDFs open live in the browser, with optional public links for sharing one achievement at a time.

The family signs in through **Firebase Authentication** and manages the archive through Google Sheets, Google Drive, and Apps Script. See **`AUTH_SETUP.md`** and **`SETUP.md`**.

---

## How the data works

The website looks for data in this order:

1. **Google Sheet** - stores the 23-column achievement records.
2. **Google Drive** - stores profile photos and up to five image/PDF evidence files per achievement.
3. **Apps Script** - provides profile and achievement CRUD operations.
4. **Built-in sample data** (`data/portfolio.js`) - used only when the live sheet cannot be loaded.

## Adding data through the website (login + form)

Approved family members first use **Sign in with Google**. In **`admin.html`**, the shared family passcode remains as a second check before Apps Script permits add, edit, or delete operations.

```
Pingping_Portfolio/
├── index.html                 ← authenticated portfolio view
├── login.html                 ← Firebase family login
├── admin.html                 ← mini profile + achievement management
├── share.html                 ← public view of one shared achievement
├── apps-script/Code.gs        ← backend (deploy to Google Apps Script)
├── css/style.css
├── js/app.js                  ← app logic (no need to edit)
├── data/
│   ├── config.js              ← paste your Google Sheet link + edit profile here
│   └── portfolio.js           ← sample/fallback data
├── assets/
│   ├── profile/               ← profile photo
│   └── certificates/          ← sample certificate files
├── SETUP.md                   ← Google Sheet + Drive setup guide (Thai)
├── AUTH_SETUP.md              ← free Firebase Auth-only setup guide (Thai)
└── README.md
```

---

## Main features

- Family-only Google sign-in with Firebase Authentication.
- Add, edit, delete, search, filter, and paginate achievements.
- Mini Profile editor with a Drive-hosted profile photo.
- Up to five certificate, award, document, or photo files per achievement.
- Video links without accepting large video uploads.
- Separate Pingping's Memory, Dad's Memory, and Mom's Memory fields.
- Live evidence preview with thumbnails.
- Public share page for one selected achievement.
- Portfolio filters, ten cards per page, and Print / Save PDF.

---

## Quick start

- **Want to test the protected site?** Configure Firebase Auth, then serve the folder over HTTP.
- **Want the family to maintain it?** Follow `SETUP.md` to connect a Google Sheet + Drive, then publish online (below).

---

## Evidence

Evidence is uploaded from Family Admin or added as a Google Drive/YouTube link. The site detects Drive, image, PDF, and YouTube links and opens them in the viewer. Drive evidence must be shared as **Anyone with the link - Viewer**.

Direct image/PDF URLs and local files in `assets/certificates/` also work.

---

## PDF export

Click **Print / Save PDF** to export a clean record. The print layout hides controls and switches to black on white.

---

## Publishing free on GitHub Pages

The Google Sheet feature needs the site to be online. Publishing is free:

1. Create a GitHub repository (e.g. `pingping-portfolio`).
2. Upload all files (or use git):
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio"
   git branch -M main
   git remote add origin https://github.com/<your-username>/pingping-portfolio.git
   git push -u origin main
   ```
3. GitHub → **Settings → Pages → Source: "Deploy from a branch"**, branch `main`, folder `/ (root)`, **Save**.
4. The site goes live at `https://<your-username>.github.io/pingping-portfolio/`.

To update content later, just edit the Google Sheet — no need to touch GitHub again.

---

## Notes

- Free static hosting on GitHub Pages; live data remains in Google Sheets and Drive.
- All content is in English, as requested.
- Responsive: works on phones, tablets, and desktops.
- Keep the real `FAMILY_PASSCODE` only in the deployed Apps Script project. The public repository must retain `change-me-family`.
