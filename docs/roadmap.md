# แผนต่อไป

## เวอร์ชัน 1: Claude Artifact (เลิกใช้แล้ว)
- [x] ปฏิทินวันว่าง + ลงหลายวัน
- [x] สถานที่ + ลิงก์ Google Maps
- [x] โหวตวันและสถานที่
- [x] profile จากชื่อ
- [x] reset พร้อม modal ยืนยัน

ข้อจำกัด
- เพื่อนต้องถูกแชร์ Artifact ให้ (บัญชีส่วนตัว: เชิญทางอีเมลเป็น Editor) ถึงจะลงข้อมูลได้
- ฝังแผนที่หรือรูปตัวอย่างจาก Google Maps ไม่ได้ (CSP ของ Artifact)
- ไม่มีการยืนยันตัวตนจริง ใครพิมพ์ชื่อคนอื่นก็แก้แทนได้

## เวอร์ชัน 2 (ตอนนี้): GitHub Pages + Firestore
- [x] Vue 3 แบบไม่ต้อง build แยก component
- [x] Firestore + security rules ตรวจรูปแบบข้อมูล
- [x] ฝังแผนที่ Google Maps ในการ์ดสถานที่
- [x] Deploy ด้วย GitHub Actions

## ต่อไป
0. Security: ล็อก API key, App Check, ลิงก์ลับต่อรอบ — ดู `security.md`
1. Firebase Auth (Google หรือ magic link) แทนการพิมพ์ชื่อ
2. หลายทริป: หน้าแรกเป็นรายการทริป แต่ละทริปมีลิงก์เชิญ (`trips/{tripId}/people`, `trips/{tripId}/places`)
3. Permission: เจ้าของทริปลบหรือปิดทริป, สมาชิกแก้ได้เฉพาะข้อมูลตัวเอง, reset ได้เฉพาะเจ้าของ
4. รูปตัวอย่างจากลิงก์ (og:image) ต้องมี Cloud Function ซึ่งต้องใช้แพ็กเกจ Blaze
5. ถ้าโค้ดใหญ่ขึ้น ย้ายไป Vite + ไฟล์ `.vue`
