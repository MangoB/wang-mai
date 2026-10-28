# โครงสร้างข้อมูล

ใช้ 2 collection แบน ๆ ใน Firestore เงื่อนไขของทุก field บังคับอยู่ใน `firestore.rules`

## `people/{key}`

คนละ 1 document เก็บทุกอย่างที่คนนั้นลงไว้

| field | type | ความหมาย |
|---|---|---|
| `name` | string | ชื่อที่แสดง (ตัดช่องว่างซ้ำแล้ว สูงสุด 30 ตัวอักษร) |
| `dates` | string[] | วันที่ว่าง รูปแบบ `YYYY-MM-DD` ตามเวลาท้องถิ่น |
| `voteDates` | string[] | วันที่โหวต |
| `votePlaces` | string[] | id ของ `places` ที่โหวต |
| `updatedAt` | number | ms epoch |

**key** = `"p"` + hex ของ UTF-8 ของชื่อ (ตัวเล็ก ตัดช่องว่างซ้ำ)
เช่น `test` → `p74657374` ทำแบบนี้เพราะ document id รับเฉพาะ `A-Z a-z 0-9 _ - . ~ : @ +` จึงใส่ชื่อภาษาไทยตรง ๆ ไม่ได้ และทำให้ชื่อเดียวกันได้ document เดียวกันเสมอ

"profile ที่ active" = มี `dates`, `voteDates` หรือ `votePlaces` อย่างน้อย 1 รายการ หรือเป็นคนเพิ่มสถานที่

## `places/{autoId}`

| field | type | ความหมาย |
|---|---|---|
| `title` | string | ชื่อสถานที่ (สูงสุด 80) |
| `url` | string | ลิงก์ Google Maps (ต้องเป็น http/https) หรือว่าง |
| `note` | string | โน้ต (สูงสุด 300) |
| `by` | string | ชื่อคนเพิ่ม |
| `byKey` | string | key ของคนเพิ่ม (ใช้เช็คสิทธิ์ลบ) |
| `createdAt` | number | ms epoch |

## การเขียน

- แต่ละคนเขียนเฉพาะ `people/{key}` ของตัวเอง โดยเขียนทั้ง document (`set`) และรวมการกดถี่ ๆ ไว้รอบเดียว (debounce ~450ms) เขียนทีละครั้ง
- นับโหวตฝั่ง client จาก `people` ทั้งหมด จึงไม่มี counter ที่ชนกัน
- Reset = ลบทุก document ใน `people` และ `places`

## ตอนย้ายไป Firebase

- เพิ่ม `trips/{tripId}` แล้วย้าย 2 collection นี้ไปไว้ใต้ทริป: `trips/{tripId}/people`, `trips/{tripId}/places`
- เปลี่ยน key จากชื่อเป็น `auth.uid` และเก็บ `name` ไว้เป็นชื่อที่แสดง
- Security rules: อ่านได้ถ้าเป็นสมาชิกทริป, เขียน `people/{uid}` ได้เฉพาะเจ้าของ
