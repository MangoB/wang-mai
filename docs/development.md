# พัฒนาต่อ

## โครงสร้างไฟล์

```
index.html                 import map (Vue, Firebase) + mount #app
src/
  main.js                  เริ่ม connect() แล้ว mount App
  firebase.js              firebaseConfig + db
  store.js                 state ทั้งหมด + ทุกการอ่าน/เขียน Firestore
  App.js                   layout หลัก: header, ประกอบ component, footer
  style.css                สไตล์ทั้งหมด (สีเป็น token บน :root รองรับ dark mode)
  lib/
    dates.js               ฟังก์ชันวันที่ (ไม่มี dependency ทดสอบด้วย node ได้)
    maps.js                อ่านลิงก์ Google Maps, ทำลิงก์ embed, ตรวจ URL
  components/
    ProfileGate.js         เลือกชื่อเดิม / สร้างชื่อใหม่
    CalendarBoard.js       ปฏิทิน + ลงทีละหลายวัน
    DateVotes.js           โหวตวัน
    PlacesBoard.js         สถานที่ + แผนที่ + โหวต
    ResetModal.js          modal ยืนยันล้างข้อมูล
firestore.rules            security rules
.github/workflows/deploy.yml
```

## หลักการ

- **component ไม่คุยกับ Firestore ตรง ๆ** — เรียกฟังก์ชันใน `store.js` เท่านั้น ถ้าจะเปลี่ยนฐานข้อมูลในอนาคตแก้ไฟล์เดียว
- **component เขียนเป็น object + `template` string** (Vue runtime compiler) ไม่ใช่ `.vue` เพราะไม่มี build step
  ถ้าใช้ VS Code ติดตั้ง extension "es6-string-html" แล้วใส่ `/* html */` หน้า template จะได้ syntax highlight
- **ข้อมูลของแต่ละคนอยู่ใน document เดียว** `people/{key}` เขียนทั้ง doc ทุกครั้ง และรวมการกดถี่ ๆ ไว้ (`queueSave`)
- **นับโหวตฝั่ง client** จากทุก document ไม่มี counter กลาง
- ข้อความ UI เป็นภาษาไทย สั้น ตรง

## เพิ่มฟีเจอร์ทั่วไป

1. ถ้าต้องเก็บข้อมูลใหม่: เพิ่ม field ใน `store.js` → อัปเดต `firestore.rules` (ไม่งั้นจะเขียนไม่ผ่าน) → อัปเดต `docs/data-model.md`
2. สร้าง component ใหม่ใน `src/components/` แล้ว import ใน `App.js`
3. ทดสอบด้วย `python3 -m http.server` แล้ว push

## Security rules

`firestore.rules` ต้อง publish แยกจากการ push โค้ด เลือกได้ 2 ทาง:

- **ง่ายสุด:** Firebase console → Firestore Database → Rules → วางเนื้อหาไฟล์ → Publish
- **CLI:** `npm i -g firebase-tools` → `firebase login` → `firebase deploy --only firestore:rules`

## Deploy

push ขึ้น `main` → GitHub Actions คัดลอก `index.html` + `src/` ขึ้น GitHub Pages (ดูสถานะที่แท็บ Actions)

## ทดสอบฟังก์ชัน

ไฟล์ใน `src/lib/` ไม่พึ่ง Vue/Firebase ทดสอบด้วย node ได้เลย:

```bash
node -e "import('./src/lib/dates.js').then(m => console.log(m.datesMatching('2026-11-01','2026-11-30',[6])))"
```

## เวอร์ชันไลบรารี

ตั้งใน import map ของ `index.html` (Vue 3.4.21, Firebase 10.12.2) อัปเกรดโดยเปลี่ยนเลขเวอร์ชันใน URL แล้วทดสอบ
