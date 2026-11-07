// End-to-end smoke test: real browser, real UI, Firebase Emulator (never production).
// Run with:  npm run test:e2e   (starts the emulators and a static server)
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

const BASE = 'http://localhost:5173';
const ROOM = 'room1';
const ROOM_CODE = 'K7QX2M';
const GUEST_CODE = 'HX4P9KTW';
const MEET = 'meet1';

function keyAfter(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const env = await initializeTestEnvironment({
  projectId: 'wang-mai',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();

// Seed: a room with an owner, a guest invite and an open meetup where the owner is free on two days.
const now = Timestamp.now();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'joinCodes', ROOM_CODE), { roomId: ROOM });
  await setDoc(doc(db, 'rooms', ROOM), { name: 'แก๊งมหาลัย', ownerUid: 'owner', joinCode: ROOM_CODE, createdAt: now });
  await setDoc(doc(db, 'rooms', ROOM, 'members', 'owner'), {
    name: 'ณัฐ', color: 0, kind: 'member', role: 'owner', status: 'active', pid: 'owner', joinCode: ROOM_CODE, joinedAt: now,
  });
  await setDoc(doc(db, 'rooms', ROOM, 'invites', GUEST_CODE), {
    name: 'ทราย', color: 7, pid: 'g_sai000000000000000000', claimedBy: null, createdBy: 'owner', createdAt: now,
  });
  await setDoc(doc(db, 'rooms', ROOM, 'meetups', MEET), {
    title: 'ข้าวเย็นปลายปี', status: 'open', result: null, drawCount: { date: 0, place: 0 }, createdBy: 'owner', createdAt: now,
  });
  await setDoc(doc(db, 'rooms', ROOM, 'meetups', MEET, 'avail', 'owner'), {
    dates: [keyAfter(2), keyAfter(3)].join(','), voteDates: '', votePlaces: [], hidden: false, updatedAt: now,
  });
});

const server = spawn('python3', ['-m', 'http.server', '5173'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1000));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const step = async (name, fn) => {
  process.stdout.write('• ' + name + ' … ');
  await fn();
  console.log('ok');
};

try {
  await step('the old link points to v2', async () => {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: 'ไปที่ว่างไหม' }).waitFor();
  });

  await step('guest joins with an invite link', async () => {
    await page.goto(BASE + '/v2/#j-' + ROOM_CODE + '-' + GUEST_CODE);
    await page.getByRole('heading', { name: 'แก๊งมหาลัย' }).waitFor({ timeout: 15000 });
  });

  await step('opens the meetup and marks a free day', async () => {
    await page.getByRole('link', { name: /ข้าวเย็นปลายปี/ }).click();
    await page.getByRole('heading', { name: 'ข้าวเย็นปลายปี' }).waitFor();
    // Mark the same two days the owner is free on: both become gold tickets.
    for (const k of [keyAfter(2), keyAfter(3)]) {
      const [y, m, d] = k.split('-').map(Number);
      const cell = page.locator('button.day:not([disabled])', { hasText: new RegExp('^\\s*' + d + '\\b') }).first();
      // Move forward a month if the day is in the next one.
      if (m !== new Date().getMonth() + 1) await page.getByRole('button', { name: 'เดือนถัดไป' }).click();
      await cell.click();
      if (m !== new Date().getMonth() + 1) await page.getByRole('button', { name: 'เดือนก่อน' }).click();
      void y;
    }
    await page.getByText(/ว่างครบแก๊ง 2 วัน/).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const s = await getDoc(doc(ctx.firestore(), 'rooms', ROOM, 'meetups', MEET, 'avail', 'g_sai000000000000000000'));
      assert.ok(s.exists(), 'guest availability saved');
      assert.equal(s.data().dates, [keyAfter(2), keyAfter(3)].sort().join(','));
    });
  });

  await step('adds a place', async () => {
    await page.getByRole('tab', { name: 'ที่นัด' }).click();
    await page.getByLabel('ชื่อที่').fill('หมูกระทะริมคลอง');
    await page.getByRole('button', { name: 'เพิ่มสถานที่' }).click();
    await page.getByRole('heading', { name: 'หมูกระทะริมคลอง' }).waitFor();
  });

  await step('co-host draws a date and concludes', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const members = ['rooms', ROOM, 'members'];
      // The guest's member doc id is their anonymous uid: promote whichever doc holds the guest pid.
      const inv = await getDoc(doc(db, 'rooms', ROOM, 'invites', GUEST_CODE));
      await updateDoc(doc(db, ...members, inv.data().claimedBy), { role: 'cohost' });
    });
    await page.getByRole('tab', { name: 'สุ่ม' }).click();
    await page.getByRole('button', { name: 'สุ่มเลย' }).click();
    await page.getByText(/ครั้งที่ 1 โดย ทราย/).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'ใช้ผลนี้สรุปนัด' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'สรุปนัด' }).click();
    await page.getByRole('button', { name: 'เปิดนัดอีกครั้ง' }).waitFor({ timeout: 10000 });
  });

  await step('co-host renames the meetup', async () => {
    await page.getByRole('button', { name: 'แก้ชื่อนัด' }).click();
    await page.getByRole('textbox', { name: 'ชื่อนัด' }).fill('ข้าวเย็นส่งท้ายปี');
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('heading', { name: 'ข้าวเย็นส่งท้ายปี' }).waitFor({ timeout: 10000 });
  });

  await step('no errors in the browser console', async () => {
    const real = errors.filter((e) => !/favicon|fonts\.g/.test(e));
    assert.deepEqual(real, []);
  });
  console.log('\nall e2e steps passed');
} catch (e) {
  console.error('\nFAILED:', e.message);
  console.error(errors.join('\n'));
  await page.screenshot({ path: 'e2e-failure.png', fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  await env.cleanup();
}
