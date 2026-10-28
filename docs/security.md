# แผน security

เป้าหมาย: คนนอกแก๊งเอาข้อมูลไปดูหรือใช้ไม่ได้ และเอาฐานข้อมูลของเราไปใช้ทำอย่างอื่นไม่ได้
โดยเพื่อนยังเข้าใช้ง่ายเหมือนเดิม (เปิดลิงก์ + พิมพ์ชื่อ)

## สถานการณ์ตอนนี้

- เว็บไม่มี server ของเราเอง เบราว์เซอร์คุยกับ Firestore ตรง ๆ
- `firebaseConfig` อยู่ในหน้าเว็บ ซ่อนไม่ได้ และไม่ใช่ความลับ (Firebase ออกแบบมาแบบนี้)
- **การป้องกันทั้งหมดจึงต้องตั้งที่ฝั่ง Firebase**

| ความเสี่ยง | ตอนนี้ |
|---|---|
| คนนอกอ่านชื่อและวันว่างของทุกคน | ❌ ใครมี config ก็อ่านได้หมด |
| เว็บอื่นหรือสคริปต์เอา db เราไปเก็บข้อมูลของเขา | 🟡 rules บังคับรูปแบบข้อมูล แต่ยังเขียนได้ |
| คนป่วนลบหรือแก้ข้อมูลของคนอื่น / กด reset | ❌ ทำได้ |
| ใช้เกินโควตาจนเสียเงิน | ✅ แพ็กเกจ Spark ไม่เก็บเงิน เกินโควตาแค่หยุดทำงานจนจบวันหรือเดือน |

## แผน (ทำเรียงตามนี้)

### ขั้น 1 — ล็อก API key ให้ใช้เฉพาะเว็บเรา
**ใครทำ:** เจ้าของโปรเจกต์ · **เวลา:** 2 นาที · **กัน:** เว็บอื่นเอา key ไปใช้ในเบราว์เซอร์

1. console.cloud.google.com → เลือกโปรเจกต์ `wang-mai`
2. APIs & Services → Credentials → **Browser key (auto created by Firebase)**
3. Application restrictions → **Websites** → เพิ่ม
   - `https://mangob.github.io/*`
   - `http://localhost:5173/*`
4. Save แล้วเปิดเว็บจริงเช็คว่ายังใช้ได้ (รอมีผลไม่กี่นาที)

> ข้อจำกัด: สคริปต์นอกเบราว์เซอร์ปลอม referrer ได้ ขั้นนี้กันได้แค่คนทั่วไป ต้องมีขั้น 2 ด้วย

### ขั้น 2 — Firebase App Check (reCAPTCHA)
**ใครทำ:** เจ้าของโปรเจกต์ + Claude · **เวลา:** 20–30 นาที · **กัน:** สคริปต์หรือแอปที่ไม่ได้มาจากหน้าเว็บเราจริง ๆ

App Check ให้หน้าเว็บขอ "ใบรับรอง" จาก reCAPTCHA แบบเบื้องหลัง (ผู้ใช้ไม่ต้องกดอะไร) แล้วแนบไปกับทุกคำขอ Firestore ปฏิเสธคำขอที่ไม่มีใบรับรอง

ฝั่งเจ้าของโปรเจกต์
1. Firebase console → **App Check** → แท็บ Apps → เลือกเว็บแอป → Register
2. เลือก provider **reCAPTCHA Enterprise** (ฟรีในปริมาณนี้) ถ้าระบบให้สร้าง key ให้สร้าง โดยใส่โดเมน `mangob.github.io` และ `localhost`
3. ส่ง **site key** มา (site key ไม่ใช่ความลับ อยู่ในโค้ดได้)

ฝั่งโค้ด (Claude)
1. เพิ่ม `firebase/app-check` ใน import map ของ `index.html`
2. เรียก `initializeAppCheck` ใน `src/firebase.js` ก่อน `getFirestore`
3. localhost ใช้ debug token: ตั้ง `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` เฉพาะตอน `location.hostname === 'localhost'` แล้วลงทะเบียน token ที่ขึ้นใน Console ไว้ที่ App Check → Manage debug tokens
4. push → เว็บจริงเริ่มส่งใบรับรอง

ฝั่งเจ้าของโปรเจกต์ (หลัง deploy)
1. App Check → APIs → Cloud Firestore → ดูกราฟ **verified requests** อย่างน้อยครึ่งวัน
2. ถ้าคำขอจากเว็บเราเป็น verified เกือบทั้งหมด กด **Enforce**

> ข้อจำกัด: คนที่เปิดหน้าเว็บเราจริงยังอ่านข้อมูลได้ทั้งหมด ต้องมีขั้น 3

### ขั้น 3 — ลิงก์ลับต่อรอบนัด (ลิงก์คือรหัสผ่าน)
**ใครทำ:** Claude · **เวลา:** 1–2 ชั่วโมง · **กัน:** คนที่ไม่มีลิงก์เห็นหรือแก้ข้อมูล

แนวคิด: ข้อมูลแต่ละรอบเก็บใต้ id สุ่มยาว ๆ ที่เดาไม่ได้ และ rules ห้าม "ดูรายการรอบทั้งหมด" คนที่ไม่รู้ id จึงหาข้อมูลไม่เจอ

```
rounds/{roundId}                 { createdAt }
rounds/{roundId}/people/{key}    (เหมือน people เดิม)
rounds/{roundId}/places/{id}     (เหมือน places เดิม)
```

- `roundId` สุ่ม 22+ ตัวอักษร (`crypto.getRandomValues`) อยู่ใน URL เช่น `https://mangob.github.io/wang-mai/#r-8fK2…`
- เปิดเว็บโดยไม่มี id → หน้า "เริ่มนัดใหม่" สร้างรอบแล้วได้ลิงก์ไปแปะในกลุ่มแชท
- ปุ่ม "คัดลอกลิงก์เชิญ" บนหน้า
- **เริ่มนัดรอบใหม่** = สร้าง roundId ใหม่ + ลบข้อมูลรอบเก่า ลิงก์เก่าใช้ไม่ได้ทันที (กันคนที่เคยได้ลิงก์ไปแล้ว)

rules
```
match /rounds/{roundId} {
  allow get: if true;           // อ่านได้ถ้ารู้ id
  allow list: if false;         // ห้ามดูรายการรอบ
  allow create: if roundId.size() >= 22 && request.resource.data.keys().hasOnly(['createdAt']);
  allow delete: if true;
  match /people/{key} { /* validPerson เดิม */ }
  match /places/{id}  { /* validPlace เดิม */ }
}
```
> `list` ของ subcollection `people`/`places` ยังเปิดได้ เพราะต้องรู้ roundId อยู่ดี

ไฟล์ที่ต้องแก้: `src/store.js` (path ทั้งหมด + สร้าง/อ่าน roundId จาก `location.hash`), `App.js` (หน้าเริ่มรอบ, ปุ่มคัดลอกลิงก์), `ResetModal.js`, `firestore.rules`, `docs/data-model.md`
ข้อมูลเดิมใน `people`/`places`: ย้ายเข้ารอบแรกหรือทิ้ง (ถามเจ้าของก่อน) แล้วปิด rules ของ path เก่า

> ข้อจำกัด: ใครได้ลิงก์ก็ยังแก้ข้อมูลของคนอื่นได้ ถ้าลิงก์หลุดไปนอกกลุ่ม ให้กด "เริ่มนัดรอบใหม่"

### ขั้น 4 (ภายหลัง) — ล็อกอิน
ทำตอนอยากแยกหลายทริปและกำหนดสิทธิ์ ดู `roadmap.md` ข้อ 1–3
กันได้ครบ: แก้ได้เฉพาะข้อมูลตัวเอง, reset ได้เฉพาะเจ้าของรอบ

## หลังทำครบขั้น 1–3

| ความเสี่ยง | ผล |
|---|---|
| คนนอกอ่านข้อมูล | ✅ ต้องมีลิงก์ลับ |
| เอา db ไปใช้ | ✅ ถูก App Check ปฏิเสธ + rules บังคับ path/รูปแบบ |
| คนในกลุ่มป่วน | 🟡 ยังทำได้ (รอขั้น 4) |

## Checklist พรุ่งนี้

- [ ] publish `firestore.rules` ปัจจุบัน (ถ้ายังไม่ได้ทำ)
- [ ] ขั้น 1: ล็อก API key
- [ ] ขั้น 2: สร้าง App Check + ส่ง site key → Claude ใส่โค้ด → deploy → ดูกราฟ → Enforce
- [ ] ขั้น 3: Claude ทำลิงก์ลับ → publish rules ใหม่ → ทดสอบกับเพื่อน 1–2 คน
- [ ] ทดสอบ: เปิดเว็บไม่มีลิงก์ต้องไม่เห็นข้อมูล, ลิงก์เก่าหลัง reset ต้องใช้ไม่ได้
