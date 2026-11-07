# พัฒนาต่อ

## โครงสร้างไฟล์

```
index.html, src/           v1: นัดแรก (เข้าด้วยการพิมพ์ชื่อ)
  firebase.js              config, App Check, ต่อ emulator อัตโนมัติบน localhost (v2 ใช้ร่วม)
  store.js                 state + ทุกการอ่าน/เขียน Firestore ของ v1
  lib/dates.js, maps.js    ฟังก์ชันวันที่และลิงก์แผนที่ (ไม่มี dependency, v2 ใช้ร่วม)
  components/              ProfileGate, CalendarBoard, DateVotes, PlacesBoard, ResetModal
v2/                        v2: ห้อง, guest, member Google (เว็บที่ /v2/)
  src/store.js             state + ทุกการอ่าน/เขียน Firestore และ Auth ของ v2
  src/App.js               router จาก hash: #r-ห้อง, #m-ห้อง-นัด, #members-ห้อง, #j-รหัสห้อง-รหัสส่วนตัว
  src/views/               JoinView, HomeView, RoomView, MeetupView, MembersView
  src/components/          CalendarPanel, PlacesPanel, DrawPanel
  src/lib/                 codes.js (สุ่มรหัส), palette.js (สีประจำตัว 12 สี)
  src/style.css            design tokens ตาม docs/design-system.md
firestore.rules            rules ของ v1 และ v2
tests/rules.test.mjs       ทดสอบ rules บน emulator
tests/e2e.mjs              ทดสอบผ่านเบราว์เซอร์จริง (Playwright + emulator)
.github/workflows/         test.yml (ทุก push), deploy.yml (push ขึ้น main)
```

## หลักการ

- ไม่มี build step: Vue 3 และ Firebase โหลดผ่าน import map, component เป็น object + `template` string
- component ไม่คุยกับ Firebase ตรง ๆ เรียกฟังก์ชันใน `store.js` เท่านั้น
- ข้อมูลของแต่ละคนอยู่ใน document เดียว เขียนทั้ง doc และรวมการกดถี่ ๆ เป็นการเขียนครั้งเดียว
- นับโหวตและวันว่างฝั่ง client ไม่มี counter กลาง
- สีสดเป็นของคนเท่านั้น UI ใช้ token ใน `style.css` รองรับธีมสว่างและมืด
- ข้อความ UI เป็นภาษาไทย สั้น ตรง

## รันในเครื่อง

API key ของเว็บจริงไม่รับ localhost โดยตั้งใจ ในเครื่องจึงใช้ Firebase Emulator (โค้ดต่อให้อัตโนมัติเมื่อเปิดจาก localhost)

```bash
npm install                                         # ครั้งแรก (เครื่องมือทดสอบเท่านั้น)
npx firebase emulators:start --only firestore,auth --project wang-mai
python3 -m http.server 5173                         # อีกหน้าต่าง → http://localhost:5173/v2/
```

## ทดสอบ

```bash
npm test            # security rules บน emulator
npm run test:e2e    # เปิดเว็บใน Chromium แล้วเดินผ่าน: เข้าห้องด้วยลิงก์เชิญ → ลงวัน → เพิ่มที่ → สุ่ม → สรุปนัด
```

GitHub Actions รันทั้งสองชุดทุกครั้งที่ push

## เพิ่มหรือแก้ข้อมูลที่เก็บ

1. แก้ `store.js` ของเวอร์ชันนั้น
2. แก้ `firestore.rules` และเพิ่มเคสใน `tests/rules.test.mjs`
3. อัปเดต `docs/data-model.md`
4. หลัง merge: publish rules (Firebase console → Firestore → Rules หรือ `npx firebase deploy --only firestore:rules`)

## Deploy

merge เข้า `main` → GitHub Actions คัดลอก `index.html`, `src/`, `v2/` ขึ้น GitHub Pages

## เวอร์ชันไลบรารี

ตั้งใน import map ของ `index.html` และ `v2/index.html` (Vue 3.4.21, Firebase 10.12.2) อัปเกรดพร้อมกันทั้งสองไฟล์
