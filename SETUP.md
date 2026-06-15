# สิ่งที่ต้องทำต่อ (Checklist) — ตั้งค่าให้ระบบใช้งานได้จริง

ส่วนที่ผมทำให้แล้ว ✅
- สร้างโฟลเดอร์ Drive **"Pingping Certificates"** (เก็บไฟล์ใบ Certificate)
- ใช้ Google Sheetเดิมของคุณ **"Pingping_Portfolio"** (24 คอลัมน์) เป็นฐานข้อมูล
- ใส่ Sheet ID + Folder ID ลงใน `apps-script/Code.gs` ให้แล้ว
- ใส่ลิงก์อ่านข้อมูล (CSV) ลงใน `data/config.js` ให้แล้ว
- ปรับหน้าเว็บ + ฟอร์ม + backend ให้ตรงกับ 24 คอลัมน์ของคุณ

> ID ที่ใช้ — Sheet: `11HwCxqYSK96hCXnqKzftd1dqphJ_t04VmVcY39Fwih8` · Folder: `13quDAcUu8dpJoWYxUp1ZtzC4XWOvBbil`

เหลือ 6 ขั้นที่ **ต้องทำด้วยบัญชี piraya.portfolio@gmail.com** 👇

---

## 1) ตั้งรหัสผ่านครอบครัวใน Code.gs
ใช้ passcode เดียวกันทั้งครอบครัวได้ โดยให้เปลี่ยน `change-me-family` เป็นรหัสจริงเฉพาะในหน้า script.google.com เท่านั้น ห้ามใส่รหัสจริงในไฟล์บนเครื่องหรือ GitHub:
```js
var FAMILY_PASSCODE = "change-me-family"; // เปลี่ยนเป็นรหัสจริงเฉพาะบน script.google.com

// Do not change these unless a Firebase account UID changes.
var FAMILY_ROLES = {
  "UB8EoJajoSXHsXQFyOzJVituP3G2": "Dad",
  "xUPFfDuynPZx2SW1R57YL8fegOp1": "Mom",
  "UyIHDYidW5e4XdOVpqKV8XtBiSH3": "Pingping",
  "V7H0qFyOwoePChyEG4ju5QYkWNl2": "Pingping"
};
```

## 2) วางโค้ดลง Apps Script
1. ไปที่ <https://script.google.com> แล้วเปิด Apps Script project เดิมของ Pingping Portfolio
2. วางเนื้อหาทั้งหมดจาก `apps-script/Code.gs` ทับโค้ดเดิม
3. เปลี่ยนเฉพาะ `FAMILY_PASSCODE = "change-me-family"` เป็นรหัสจริงในหน้า Apps Script แล้วกด **Save**
4. ที่แถบเลือกฟังก์ชันด้านบน เลือก `authorizeFirebaseAccess` แล้วกด **Run** หนึ่งครั้ง
5. กด **Review permissions** เลือกบัญชีเจ้าของ Apps Script แล้วกด **Allow** เพื่ออนุญาต external request

หลัง Deploy แล้ว หน้า Family Admin สามารถแก้ Mini Profile และอัปโหลดรูปได้ ระบบจะสร้างแท็บ `_Profile`
ใน Google Sheet และโฟลเดอร์ย่อย `Profile Photos` ใน Drive ให้อัตโนมัติเมื่อกด Save Profile ครั้งแรก

หน้า Portfolio มีปุ่ม Share รายผลงาน ลิงก์รูปแบบ `share.html?id=PP-xxxx` เปิดได้โดยไม่ต้อง Login
และจะแสดงเฉพาะผลงานนั้น เหมาะสำหรับส่งให้ญาติ แต่ทุกคนที่ได้รับลิงก์สามารถเปิดดูได้

## 3) Deploy เป็น Web App
1. มุมขวาบน **Deploy → New deployment** → เลือกชนิด **Web app** (กดเฟือง ⚙)
2. ตั้งค่า: **Execute as: Me (piraya.portfolio)** · **Who has access: Anyone**  ← สำคัญทั้งสองอัน
3. **Deploy** → ครั้งแรกต้อง **Authorize access** → เลือกบัญชี piraya.portfolio →
   ถ้าเตือน "Google hasn't verified" กด **Advanced → Go to … → Allow**
4. คัดลอก **Web app URL** (ลงท้าย `/exec`)

> แก้โค้ดเมื่อไหร่ ต้อง **Manage deployments → แก้ version → Deploy** ใหม่ทุกครั้ง

# AKfycbyLftlHpBwiFcnz8OPgnIwplI7jPPCbFGhRpVkU6Yt-BlOVAzaLqAj9P5FtkHcM8QNm
# https://script.google.com/macros/s/AKfycbyLftlHpBwiFcnz8OPgnIwplI7jPPCbFGhRpVkU6Yt-BlOVAzaLqAj9P5FtkHcM8QNm/exec


## 4) วางลิงก์ /exec ลงในเว็บ
เปิด `data/config.js` วางลิงก์ในช่อง `scriptUrl`:
```js
scriptUrl: "วาง Web app URL /exec ที่ได้จากขั้น 3",
```

## 5) แชร์ Google Sheet ให้เว็บอ่านได้
เปิดชีต "Pingping_Portfolio" → **Share** → General access เปลี่ยนเป็น
**Anyone with the link → Viewer** → Done
(โฟลเดอร์ Drive ไม่ต้องตั้งเอง — สคริปต์ตั้งแชร์ไฟล์ที่อัปโหลดให้อัตโนมัติ)

> ถ้าหน้าเว็บยังไม่ขึ้นข้อมูลหลังแชร์ ลองวิธีสำรอง: ในชีต **File → Share → Publish to web → CSV**
> แล้วเอาลิงก์นั้นไปใส่แทนใน `sheetCsvUrl`

## 6) ตั้ง Firebase Login และนำเว็บขึ้น GitHub Pages (ฟรี)
0. ทำตาม `AUTH_SETUP.md` เพื่อตั้ง Firebase Authentication แบบ Spark ฟรีก่อน
1. สร้าง repo บน GitHub แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
2. **Settings → Pages → Deploy from a branch** → `main` / `root` → Save
3. ได้ลิงก์: `https://<username>.github.io/<repo>/` (หน้าเพิ่มข้อมูลคือเติม `/admin.html`)

> ความปลอดภัย: ถ้า repo เป็น **public** อย่า push `Code.gs` ที่มีรหัสจริง — ใส่ค่า placeholder ก่อน หรือทำ repo เป็น private

---

## ทดสอบว่าใช้ได้
1. เปิด `…/admin.html` → ใส่รหัสตัวเอง → Sign in
2. กรอกฟอร์ม (ขั้นต่ำ: Activity name, Category, Year) + แนบไฟล์/วางลิงก์ → **Save achievement**
3. กลับหน้าแรก รายการใหม่จะขึ้นภายในเวลาไม่นาน (CSV มีดีเลย์เล็กน้อย กด Refresh ได้)

## การแมปฟอร์ม → คอลัมน์ในชีต
ฟอร์มเขียนลงคอลัมน์เดิมของคุณทั้งหมด: Activity/Competition Name, Category, Year, Level,
Result/Award, Score/Rank, Organizer, Age, Grade, School, Participation Type, Role, Frequency,
Duration, Evidence Type, Evidence Link (ไฟล์ที่อัป + ลิงก์ที่กรอก), Student Reflection,
Dad's Memory, Mom's Memory, Importance Level, Use for University และ Notes

---

## ⚠️ อัปเดต: ตอนนี้ระบบ "แก้ไข / ลบ" ได้แล้ว — ต้อง Deploy ใหม่
ผมเพิ่มความสามารถ **list / edit / delete** ลงใน `apps-script/Code.gs`
ถ้าคุณ deploy เวอร์ชันเก่าไปแล้ว ต้องอัปโค้ดใหม่:
1. ก๊อปปี้เนื้อหา `apps-script/Code.gs` (เวอร์ชันล่าสุด) ไปวางทับใน script.google.com → **Save**
2. **Deploy → Manage deployments → (ดินสอแก้ไข) → Version: New version → Deploy**
3. URL `/exec` เดิมใช้ได้ต่อ ไม่ต้องเปลี่ยนใน `config.js`

วิธีใช้: เข้า `admin.html` → ใต้ฟอร์มจะมีหัวข้อ **"Saved achievements"** แสดงรายการที่บันทึกไว้
- ปุ่ม **Edit** = ดึงข้อมูลเดิมมาใส่ฟอร์ม แก้แล้วกด "Save changes" (อัปไฟล์ใหม่จะ "เพิ่ม" ต่อจากลิงก์เดิม; ลบลิงก์เดิมได้โดยลบบรรทัดในช่อง Evidence links)
- ปุ่ม **Delete** = ลบแถวออกจากชีต (ไฟล์ใน Drive ยังอยู่ เผื่อกู้คืน)
