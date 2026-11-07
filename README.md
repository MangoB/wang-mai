# ว่างไหม (wang-mai)

เว็บนัดเจอเพื่อน: ลงวันว่างบนปฏิทิน เสนอสถานที่ โหวต แล้วสรุปนัด

- **ลิงก์เดิม:** https://mangob.github.io/wang-mai/ ชี้ไปเวอร์ชันใหม่ (นัดแรกย้ายเข้า v2 แล้ว)
- **ห้อง (v2, รุ่นทดลอง):** https://mangob.github.io/wang-mai/v2/

## v2

- **ห้องและนัด** — ห้อง = แก๊งเพื่อนที่อยู่ถาวร, ในห้องมีได้หลายนัด และเก็บประวัติว่าเคยไปไหนกัน
- **สีประจำตัว** — แต่ละคนมีสติกเกอร์สีของตัวเองบนปฏิทิน เห็นทันทีว่าใครว่างวันไหน
- **ว่างครบแก๊ง** — วันที่ทุกคนว่างและที่ที่ทุกคนโหวตได้กรอบทองพร้อมมงกุฎ มีแถบสรุปเหนือปฏิทิน
- **ลงทีละหลายวัน** — เลือกวันในสัปดาห์และช่วงวันที่ เช่น ทุกเสาร์ทั้งเดือน
- **สุ่มพร้อมหลักฐาน** — สุ่มวันหรือที่จากตัวเลือกที่ติ๊กไว้ ได้ 3 ครั้งต่อประเภท ทุกครั้งถูกบันทึกและลบไม่ได้
- **3 วิธีเข้า** — member ล็อกอิน Google + รหัสห้อง, guest ใช้ลิงก์เชิญส่วนตัว, owner/co-host ดูแลห้อง (นำออก, บล็อก, เปลี่ยนรหัสห้อง)

## เทคโนโลยี

- Vue 3 แบบไม่ต้อง build (ES modules + import map)
- Firebase: Firestore, Auth (Google, Anonymous), App Check (reCAPTCHA Enterprise)
- Security rules ตรวจสิทธิ์ตามบทบาทและรูปแบบข้อมูลทุก field
- ทดสอบ rules และ end-to-end บน Firebase Emulator ทุกครั้งที่ push (GitHub Actions + Playwright)
- GitHub Pages

## เอกสาร

- [`docs/development.md`](docs/development.md) — โครงสร้างไฟล์ การรันในเครื่อง การทดสอบ
- [`docs/data-model.md`](docs/data-model.md) — โครงสร้างข้อมูล v1 และ v2
- [`docs/security.md`](docs/security.md) — ใครเห็นอะไร และป้องกันด้วยอะไร
- [`docs/requirements.md`](docs/requirements.md) — ขอบเขตของ v2
- [`docs/design-system.md`](docs/design-system.md) — สี ตัวอักษร และสถานะของช่องวัน
- [`docs/roadmap.md`](docs/roadmap.md) — ทำอะไรไปแล้ว และอะไรต่อไป
