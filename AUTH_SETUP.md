# ตั้งค่า Firebase Authentication อย่างเดียว (ฟรี)

ระบบนี้ใช้ Firebase เฉพาะ **Sign in with Google** ก่อนเปิดหน้า Portfolio และ Admin เท่านั้น

- ใช้ Firebase Spark plan ได้ฟรี
- ไม่ต้องผูกบัตรหรือเปิด Billing
- Google Authentication รองรับได้ถึง 50,000 monthly active users ในโควตาฟรี ซึ่งเกินพอสำหรับครอบครัว
- ไม่ใช้ Firebase Storage, Firestore, Hosting หรือ Cloud Functions
- Google Sheet, Google Drive และ Apps Script เดิมไม่เปลี่ยน
- ห้ามเปิด Phone Authentication เพราะ SMS มีค่าใช้จ่าย

เอกสารราคาอย่างเป็นทางการ: <https://firebase.google.com/pricing>

## 1. สร้าง Firebase project แบบฟรี

1. เข้า <https://console.firebase.google.com>
2. กด **Create a project**
3. ตั้งชื่อ เช่น `pingping-portfolio-auth`
4. Google Analytics ไม่จำเป็น
5. คงแผน **Spark / No-cost** ไว้ ไม่ต้องเพิ่ม Billing Account

## 2. เพิ่ม Firebase Web App

1. Project Overview → กดไอคอน Web `</>`
2. ตั้งชื่อ app เช่น `Pingping Portfolio Web`
3. ไม่ต้องเปิด Firebase Hosting เพราะเราจะใช้ GitHub Pages
4. กด Register app แล้วคัดลอกค่าจาก `firebaseConfig`

นำค่าที่ได้ไปใส่ใน `data/config.js`:

```js
firebase: {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "..."
},
```

Firebase Web config ไม่ใช่ password และสามารถอยู่ใน GitHub repository ได้

## 3. เปิด Sign in with Google

1. Firebase Console → **Authentication → Get started**
2. **Sign-in method → Google**
3. เปิด Enable
4. Public-facing name ใช้ `Pingping Portfolio`
5. Support email เลือก `piraya.portfolio@gmail.com`
6. กด Save
7. ปิด Email/Password ไว้ได้ และไม่ต้องเปิด Phone

## 4. Login ครั้งแรกเพื่อรับ UID

Firebase จะสร้าง UID ให้บัญชี Google หลัง Sign in ครั้งแรก จึงต้อง bootstrap ตามนี้:

1. ใส่ Firebase Web config ใน `data/config.js`
2. ใส่ค่าชั่วคราวใน `allowedUids`: `"SETUP-FIRST-LOGIN"`
3. เปิดเว็บผ่าน local server แล้วกด Continue with Google ด้วยบัญชีครอบครัว
4. เว็บจะปฏิเสธบัญชีในครั้งแรกตามปกติ แต่ Firebase จะสร้างผู้ใช้ไว้แล้ว
5. Firebase Console → Authentication → Users → คัดลอก UID ของบัญชีนั้น
6. นำ UID จริงมาแทนค่าชั่วคราวใน `allowedUids`
7. ทำซ้ำสำหรับบัญชี Google ของ Dad, Mom และ Pingping

เมื่อครบแล้ว config ควรมีลักษณะนี้:

```js
allowedUids: [
  "UID_ของคุณพ่อ",
  "UID_ของคุณแม่",
  "UID_ของผิงผิง"
],
```

วิธีนี้ไม่ต้องเผยแพร่อีเมลของครอบครัวใน GitHub source

## 5. เพิ่ม Authorized Domains

Firebase Console → Authentication → **Settings → Authorized domains**

เพิ่มโดเมน GitHub Pages โดยไม่ใส่ `https://` และไม่ใส่ path:

```text
YOUR_GITHUB_USERNAME.github.io
```

`localhost` ใช้สำหรับทดสอบในเครื่องและโดยปกติมีอยู่แล้ว

## 6. ทดสอบ

JavaScript modules ต้องเปิดผ่าน HTTP server ห้ามเปิด `file://` โดยตรง

ถ้ามี Node.js:

```powershell
node scripts/serve.mjs
```

หรือใช้ Live Server แล้วทดสอบ:

1. เปิด `index.html` โดยยังไม่ Login → ต้องไป `login.html`
2. กด Continue with Google และเลือกบัญชีที่ UID อยู่ใน `allowedUids` → เปิด Portfolio ได้
3. เปิด `admin.html` → ผ่าน Firebase ก่อน แล้วจึงพบ Family passcode เดิม
4. กด Sign out → กลับหน้า Login
5. บัญชี Google ที่ UID ไม่อยู่ใน allowlist ต้องถูก Sign out และเข้าไม่ได้

### ให้สมาชิกครอบครัว Login จากเครื่องของตนใน Wi-Fi เดียวกัน

เปิด server ให้รับการเชื่อมต่อจากวง LAN:

```powershell
$env:HOST="0.0.0.0"
node scripts/serve.mjs
```

จากนั้นเพิ่ม IP ของเครื่อง server เช่น `192.168.30.22` ใน Firebase Authorized domains
โดยไม่ใส่ `http://` และไม่ใส่พอร์ต แล้วให้สมาชิกเปิด:

```text
http://192.168.30.22:8000/login.html
```

เครื่องต้องอยู่ในเครือข่ายเดียวกัน และ Windows Firewall ต้องอนุญาต Node.js บน Private network

## ขอบเขตความปลอดภัย

Firebase Login นี้เป็นประตูของหน้าเว็บ แต่ไม่ได้ทำให้ Google Sheet หรือ Google Drive link เป็น private และผู้ใช้ยอมรับเงื่อนไข “ใครมีลิงก์โดยตรงก็เปิดได้” แล้ว

เนื่องจาก GitHub Pages เป็น static hosting ผู้ที่ตั้งใจแกะ source code สามารถข้าม client-side gate ได้ ระบบนี้จึงเหมาะสำหรับลดการเข้าถึงโดยบังเอิญ ไม่ใช่ระบบเก็บข้อมูลลับระดับสูง

## Shared admin passcode and family roles (2026-06-14)

บัญชี Google ทั้ง 4 บัญชีใช้ Family passcode เดียวกันได้ เพราะบทบาทไม่ได้ตัดสินจาก passcode
หน้า Admin จะส่ง Firebase ID token ใหม่ไปยัง Apps Script ซึ่งตรวจ token กับ Firebase Authentication
แล้วจับคู่ UID เป็น Dad, Mom หรือ Pingping ฝั่ง server

ให้ใส่ passcode จริงใน `FAMILY_PASSCODE` เฉพาะ Code.gs ที่ script.google.com เท่านั้น
ไฟล์ในเครื่องและ GitHub ต้องคงค่า `change-me-family` ไว้ หลังแก้ Code.gs ต้อง Deploy เป็น New version
โดย URL `/exec` เดิมยังใช้ต่อได้ การเรียกครั้งแรกอาจขอสิทธิ์ `UrlFetchApp` เพิ่มจากเจ้าของ Apps Script
