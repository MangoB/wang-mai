# โครงสร้างข้อมูล

# v1: นัดแรก

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

---

# v2: ห้อง

ใช้งานที่ `/v2/` · rules อยู่ใน `firestore.rules` ส่วน v2 · ทดสอบใน `tests/rules.test.mjs`

```
admins/{uid}                              {}                                    ← console เท่านั้น
users/{uid}                               name, color, roomCount, rooms[], createdAt   (member Google)
joinCodes/{roomCode}                      roomId                                ← get ได้ list ไม่ได้
rooms/{roomId}                            name, ownerUid, joinCode, createdAt
  members/{uid}                           name, color, kind(member|guest), role(owner|cohost|participant),
                                          status(active|blocked), pid, joinCode? | inviteCode?, joinedAt
  invites/{guestCode}                     name, color, pid, claimedBy, createdBy, createdAt
  meetups/{meetId}                        title, status(open|done), result{date, placeId, placeTitle, placeUrl, via}, drawCount{date, place}, createdBy, createdAt
    avail/{pid}                           dates "YYYY-MM-DD,…", voteDates "…", votePlaces[], hidden, updatedAt
    places/{placeId}                      title, mapsUrl, gPlaceId, address, note, pid, createdAt
    draws/{drawId}                        kind(date|place), candidates[], result, n(1–3), pid, at   ← สร้างได้อย่างเดียว
```

- **pid** = ตัวตนของคนในห้องที่ไม่เปลี่ยนตามเครื่อง: member ใช้ uid, guest ใช้ `pid` ที่ gen ตอนสร้าง invite
- **color** = เลข 0–11 ชี้ไปที่ชุดสีประจำตัวใน design system (`docs/design-system.md`) ไม่เก็บ hex สีใน `users` เป็นแค่ค่าเริ่มต้น สีจริงของแต่ละห้องอยู่ใน `members` ถ้าตอนเข้าห้องมีคนใช้สีนี้แล้ว แอปเลือกสีที่ว่างให้ (member เปลี่ยนเองได้ในหน้าสมาชิก, สีของ guest เจ้าของห้องเลือกตอนสร้าง invite)
- **hidden** อยู่ใน `avail` เพราะ "ซ่อน" มีผลเฉพาะนัดนั้น
- **เตะออก** = ลบ `members/{uid}`; **บล็อก** = `status: blocked` (เก็บไว้กันกลับเข้า)
- **สรุปนัด** = `meetups.status = done` + `result`; นัดที่ done อ่านได้ แก้ avail/places ไม่ได้
