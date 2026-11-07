# Security — ว่างไหม

ออกแบบตาม `requirements.md` · rules: `firestore.rules` · ทดสอบ: `tests/rules.test.mjs`

## หลักการ

config ของ Firebase อยู่ในหน้าเว็บ ซ่อนไม่ได้ และไม่ต้องซ่อน — **ข้อมูลลับได้ แต่กุญแจประตูหน้าบ้านลับไม่ได้**
ทุกคำขอต้องผ่าน 4 ด่านพร้อมกัน:

1. **App Check** (reCAPTCHA Enterprise, บังคับใช้) — ต้องมาจากหน้าเว็บเราในเบราว์เซอร์จริง
2. **Auth** — Google (member/admin) หรือ anonymous ที่ผูกกับรหัส guest
3. **สมาชิกห้อง** — อ่าน/เขียนได้เฉพาะห้องที่เป็นสมาชิก และไม่ถูกบล็อก
4. **บทบาท** — แก้ได้เฉพาะของตัวเอง; ดูแลห้อง/สุ่ม = owner + co-host

## ใครเห็นอะไร

| ข้อมูล | คนนอก (มี config) | member ห้องอื่น | สมาชิกในห้อง | owner/co-host | admin |
|---|---|---|---|---|---|
| ห้องนี้มีอยู่ไหม, ชื่อห้อง | ❌ | ❌ | ✅ | ✅ | ✅ |
| ชื่อ, วันว่าง, โหวต, สถานที่ | ❌ | ❌ | ✅ | ✅ | ✅ |
| รหัส guest | ❌ | ❌ | ❌ | ✅ | ✅ |
| รหัสห้อง | ❌ | ❌ | ✅ | ✅ | ✅ |
| อีเมล Google | ❌ | ❌ | ❌ ไม่เก็บลง db | ❌ | Firebase console เท่านั้น |
| ประวัติสุ่ม | ❌ | ❌ | ✅ แก้/ลบไม่ได้ | ✅ แก้/ลบไม่ได้ | ✅ |
| ตั้งตัวเองเป็น admin/owner | ❌ | ❌ | ❌ | ❌ | ใส่ผ่าน console เท่านั้น |

## สิ่งที่ลับไม่ได้

- โค้ดและ rules (repo สาธารณะ) — รู้วิธีทำงาน ≠ ผ่านด่าน
- การมีอยู่ของเว็บ — คนนอกเห็นแค่หน้าเข้าห้อง
- คนในห้องแคปหน้าจอ — ระบบห้ามไม่ได้ แก้ด้วยบล็อก + เปลี่ยนรหัสห้อง
- รหัสห้องที่หลุด — member Google เข้าได้ (ไม่ต้องอนุมัติตาม requirement) → owner เห็นทันที บล็อก + เปลี่ยนรหัสได้
- IP ของผู้ใช้ — ไม่มี server จึงมองไม่เห็น ใช้บล็อกราย uid แทน

## วิธีเข้าแต่ละแบบ

**Member (Google)**
1. ล็อกอิน Google → สร้าง `users/{uid}` (ชื่อ, สี)
2. พิมพ์รหัสห้อง → `get joinCodes/{code}` ได้ `roomId`
3. สร้าง `rooms/{roomId}/members/{uid}` พร้อมแนบ `joinCode` — rules ตรวจว่ารหัสชี้มาห้องนี้จริง
4. เพิ่ม `roomId` ลง `users/{uid}.rooms` (จำห้อง ข้ามเครื่องได้)

**Guest (รหัสห้อง + รหัสส่วนตัว / ลิงก์เชิญ)**
1. ล็อกอิน anonymous (มองไม่เห็นในหน้าจอ)
2. `get joinCodes/{roomCode}` → `roomId`; `get invites/{guestCode}` (รู้รหัสถึงจะเปิดได้)
3. batch เดียว: `invites/{guestCode}.claimedBy = uid` + สร้าง `members/{uid}` (ชื่อ/สี/pid ต้องตรงกับ invite)
4. เครื่องใหม่ทำซ้ำได้ → `claimedBy` เปลี่ยน เครื่องเก่าหลุดสิทธิ์ทันที (rules เช็ค `claimedBy`)
5. ข้อมูลผูกกับ `pid` ของ invite ไม่ใช่ uid จึงไม่หายตอนเปลี่ยนเครื่อง

ลิงก์เชิญ: `…/wang-mai/#j-{roomCode}-{guestCode}` — อยู่หลัง `#` จึงไม่ถูกส่งไป server หรือบันทึกใน log ของ GitHub Pages

**Admin**: บัญชี Google ของเจ้าของ + เอกสาร `admins/{uid}` ที่ใส่เองใน Firebase console (rules ห้ามทุกคนเขียน)

## รหัส

- รหัสห้อง 6 ตัว, รหัส guest 8 ตัว จาก 31 ตัวอักษร (ตัด 0/O/1/I) → ~8.9×10⁸ และ ~8.5×10¹¹ แบบ
- เก็บเป็นชื่อ document; rules อนุญาต `get` แต่ห้าม `list` → ต้องรู้รหัสถึงจะเจอ
- App Check กันสคริปต์เดารัว; โควตาอ่านฟรี 50,000/วัน เป็นเพดานธรรมชาติ
- สร้างด้วย `crypto.getRandomValues` เท่านั้น

## กันใช้ทรัพยากรเกิน

- member สร้างห้องได้ไม่เกิน 5 (`users.roomCount` เพิ่มได้ทีละ 1 ใน batch เดียวกับการสร้างห้อง)
- วันที่เก็บเป็น string `YYYY-MM-DD,…` ตรวจด้วย regex ทั้งก้อน → ยัดข้อมูลอื่นไม่ได้
- ทุก field มีความยาวสูงสุด และ `keys().hasOnly([...])` กัน field แปลกปลอม
- Firebase อยู่แพ็กเกจ Spark ตลอด (ไม่มีบัตร)

## การสุ่ม (หลักฐาน)

- `draws` สร้างได้อย่างเดียว แก้/ลบไม่ได้ — ทุกคนรวม owner
- เวลา = `request.time` (เวลา server) ปลอมไม่ได้
- ผลต้องอยู่ใน `candidates`; ลำดับครั้ง `n` ต้องตรงกับ `meetup.drawCount` ที่เพิ่ม +1 ใน batch เดียวกัน → สุ่มได้ไม่เกิน 3 ครั้งต่อประเภทต่อนัด และข้ามเลขไม่ได้
- ข้อจำกัด: สุ่มในเบราว์เซอร์ของ host — คนที่แก้โค้ดเป็นบังคับผลได้ในทางทฤษฎี แต่ host สรุปนัดเองได้อยู่แล้ว จึงไม่มีแรงจูงใจ ถ้าต้องการ "พิสูจน์ว่าไม่โกง" 100% ต้องมี server (ภายหลัง)

## รูปสถานที่ (Google Places, ทางเลือก ข)

- **โปรเจกต์ Google Cloud แยก** (เช่น `wang-mai-maps`) ผูกบัตรเฉพาะโปรเจกต์นี้ — Firebase ไม่เกี่ยว ยังฟรี
- API key ของแผนที่: จำกัดเว็บไซต์ (`mangob.github.io`), จำกัด API (Places API (New) + Maps Embed เท่านั้น)
- **เพดานรายวัน** ใน Quotas ต่ำกว่าโควตาฟรี (เช่น รูป ≤ 30/วัน, Autocomplete/Details ≤ 300/วัน)
- งบแจ้งเตือน 1 บาท
- เกินเพดาน → การ์ดแสดงแผนที่ฝังแทนรูป, ไม่มีค่าใช้จ่าย
- เก็บเฉพาะ `gPlaceId` ใน db (เงื่อนไขของ Google ห้าม cache รูป/รายละเอียด)

## สถานะ

- [x] API key ของ Firebase ใช้ได้เฉพาะ `mangob.github.io` และ `wang-mai.firebaseapp.com` (ไม่มี localhost)
- [x] Auth: Google + Anonymous, Authorized domains ไม่มี localhost
- [x] App Check (reCAPTCHA Enterprise, key เฉพาะ `mangob.github.io`, token อายุ 12 ชั่วโมง) ลงทะเบียนและส่ง token จาก v1/v2
- [x] rules v1 + v2 ผ่านชุดทดสอบบน emulator
- [ ] Enforce App Check (Firestore + Auth) หลังดูกราฟ
- [x] `admins/{uid}` ของเจ้าของ
- [x] ย้ายนัดแรกเข้า v2 แล้วปิดการเขียน `people`/`places`
- [ ] รูปสถานที่ผ่านโปรเจกต์แผนที่แยก (Phase 4)

## กฎถาวร

- **ห้ามเพิ่ม localhost** ใน API key restrictions, reCAPTCHA key หรือ Authorized domains ของ production — พัฒนาด้วย Firebase Emulator / App Check debug token
- App Check debug token เป็นความลับ ห้าม commit
- ห้ามสร้าง/ดาวน์โหลด/commit private key ของ service account — ถ้าจำเป็น เก็บใน GitHub Secrets เท่านั้น
- ห้ามเก็บอีเมลผู้ใช้ลง Firestore
- เปิด 2FA ในบัญชี Google ของเจ้าของโปรเจกต์
