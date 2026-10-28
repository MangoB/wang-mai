# แผนต่อไป

## ตอนนี้: Claude Artifact
- [x] ปฏิทินวันว่าง + ลงหลายวัน
- [x] สถานที่ + ลิงก์ Google Maps
- [x] โหวตวันและสถานที่
- [x] profile จากชื่อ
- [x] reset พร้อม modal ยืนยัน

ข้อจำกัด
- เพื่อนต้องถูกแชร์ Artifact ให้ (บัญชีส่วนตัว: เชิญทางอีเมลเป็น Editor) ถึงจะลงข้อมูลได้
- ฝังแผนที่หรือรูปตัวอย่างจาก Google Maps ไม่ได้ (CSP ของ Artifact)
- ไม่มีการยืนยันตัวตนจริง ใครพิมพ์ชื่อคนอื่นก็แก้แทนได้

## ต่อไป: GitHub Pages + Firebase
1. ตั้งโปรเจกต์ Vue 3 + Vite แยก component (Calendar, QuickFill, DateVotes, Places, ProfileGate, ResetModal)
2. เปลี่ยนชั้นข้อมูลจาก `claude.use("db")` เป็น Firestore — API ใกล้กัน (`collection`, `doc`, `set`, `onSnapshot`)
3. Firebase Auth (Google หรือ magic link)
4. หลายทริป: หน้าแรกเป็นรายการทริป แต่ละทริปมีลิงก์เชิญ
5. Permission: เจ้าของทริปลบ/ปิดทริป, สมาชิกแก้ข้อมูลของตัวเอง
6. ฝังแผนที่ด้วย Google Maps Embed และ Cloud Function ดึงรูปตัวอย่าง (og:image) จากลิงก์
7. Deploy ด้วย GitHub Actions ขึ้น GitHub Pages
