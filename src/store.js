// Shared app state + every read/write to Firestore. Components import from here.
import { reactive, ref, computed } from 'vue';
import {
  collection, doc, setDoc, addDoc, deleteDoc, onSnapshot, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { keyOfDate, startOfToday } from './lib/dates.js';

// ---------- helpers ----------
export const normName = (s) => s.replace(/\s+/g, ' ').trim();
/** Firestore ids can't hold Thai, so a person's id is "p" + hex of the lowercased UTF-8 name. */
export const nameKey = (s) => 'p' + Array.from(new TextEncoder().encode(normName(s).toLowerCase()))
  .map((b) => b.toString(16).padStart(2, '0')).join('');

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const LS_NAME = 'wangmai.name';

// ---------- state ----------
export const today = startOfToday();
export const todayKey = keyOfDate(today);

export const status = reactive({ connected: false, error: '', saving: '' });
export const peopleDocs = ref([]);
export const placeDocs = ref([]);
export const meName = ref(LS.get(LS_NAME) || '');
export const meKey = computed(() => (meName.value ? nameKey(meName.value) : ''));
/** My own entries. Edited locally first, then written to people/{meKey}. */
export const me = reactive({ dates: [], voteDates: [], votePlaces: [] });

const toastState = reactive({ text: '', t: null });
export const toast = computed(() => toastState.text);
export function say(text) {
  toastState.text = text;
  clearTimeout(toastState.t);
  toastState.t = setTimeout(() => { toastState.text = ''; }, 2600);
}

// ---------- derived ----------
/** Everyone, with my unsaved local edits laid over my stored doc. */
const people = computed(() => {
  const list = peopleDocs.value.map((d) => ({
    key: d.id, name: d.name || '?', dates: d.dates || [], voteDates: d.voteDates || [], votePlaces: d.votePlaces || [],
  }));
  if (meKey.value) {
    const mine = { key: meKey.value, name: meName.value, dates: me.dates, voteDates: me.voteDates, votePlaces: me.votePlaces };
    const i = list.findIndex((p) => p.key === meKey.value);
    if (i >= 0) list[i] = mine;
    else if (me.dates.length || me.voteDates.length || me.votePlaces.length) list.push(mine);
  }
  return list;
});

/** A profile counts as active once it has entered anything. */
export const activePeople = computed(() => {
  const adders = new Set(placeDocs.value.map((p) => p.byKey));
  return people.value
    .filter((p) => p.dates.length || p.voteDates.length || p.votePlaces.length || adders.has(p.key))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
});

/** date → names free that day */
export const availMap = computed(() => {
  const m = {};
  for (const p of activePeople.value) for (const d of p.dates) (m[d] = m[d] || []).push(p.name);
  return m;
});

export const topDates = computed(() => {
  const votes = {};
  for (const p of activePeople.value) for (const d of p.voteDates) (votes[d] = votes[d] || []).push(p.name);
  const keys = new Set([...Object.keys(availMap.value), ...Object.keys(votes)]);
  return [...keys].filter((d) => d >= todayKey)
    .map((d) => ({ date: d, names: availMap.value[d] || [], votes: votes[d] || [] }))
    .sort((a, b) => (b.votes.length - a.votes.length) || (b.names.length - a.names.length) || a.date.localeCompare(b.date))
    .slice(0, 10);
});

export const placesSorted = computed(() => {
  const votes = {};
  for (const p of activePeople.value) for (const id of p.votePlaces) (votes[id] = votes[id] || []).push(p.name);
  return placeDocs.value
    .map((p) => ({ ...p, votes: votes[p.id] || [] }))
    .sort((a, b) => (b.votes.length - a.votes.length) || ((a.createdAt || 0) - (b.createdAt || 0)));
});

// ---------- profile ----------
function syncMeFromStore() {
  const d = peopleDocs.value.find((p) => p.id === meKey.value);
  me.dates.splice(0, me.dates.length, ...((d && d.dates) || []));
  me.voteDates.splice(0, me.voteDates.length, ...((d && d.voteDates) || []));
  me.votePlaces.splice(0, me.votePlaces.length, ...((d && d.votePlaces) || []));
}

export function pickProfile(p) {
  meName.value = p.name;
  LS.set(LS_NAME, p.name);
  syncMeFromStore();
  say('ยินดีต้อนรับกลับ ' + p.name);
}

/** Returns an error message, or '' when the profile was created. */
export function createProfile(raw) {
  const n = normName(raw || '');
  if (!n) return 'พิมพ์ชื่อก่อน';
  if (n.length > 30) return 'ชื่อยาวเกิน 30 ตัวอักษร';
  if (activePeople.value.some((p) => p.key === nameKey(n))) {
    return 'ชื่อ "' + n + '" มีคนใช้อยู่แล้ว ถ้าเป็นคุณ ให้เลือกจาก "ใช้ชื่อเดิม" หรือพิมพ์ชื่ออื่น';
  }
  meName.value = n;
  LS.set(LS_NAME, n);
  syncMeFromStore();
  say('สวัสดี ' + n + ' เริ่มลงวันว่างได้เลย');
  return '';
}

export function logout() {
  flushNow();
  meName.value = '';
  LS.set(LS_NAME, null);
  me.dates.splice(0); me.voteDates.splice(0); me.votePlaces.splice(0);
}

/** Guard for any edit: needs a name and a live connection. */
export function canEdit() {
  if (!meName.value) {
    say('พิมพ์ชื่อก่อนเริ่มลงข้อมูล');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return false;
  }
  if (!status.connected) { say('ยังเชื่อมต่อฐานข้อมูลไม่ได้'); return false; }
  return true;
}

// ---------- my edits ----------
export function toggleDate(k) {
  if (!canEdit()) return;
  const i = me.dates.indexOf(k);
  if (i >= 0) me.dates.splice(i, 1); else me.dates.push(k);
  me.dates.sort();
  queueSave();
}

/** Add or remove many dates at once; returns how many changed. */
export function setDates(keys, add) {
  if (!canEdit()) return 0;
  const set = new Set(me.dates);
  let changed = 0;
  for (const k of keys) {
    if (add && !set.has(k)) { set.add(k); changed++; }
    if (!add && set.has(k)) { set.delete(k); changed++; }
  }
  if (changed) { me.dates.splice(0, me.dates.length, ...[...set].sort()); queueSave(); }
  return changed;
}

export function clearMyDates() {
  if (!canEdit()) return;
  me.dates.splice(0);
  queueSave();
}

export function toggleVote(field, val) {
  if (!canEdit()) return;
  const arr = me[field];
  const i = arr.indexOf(val);
  if (i >= 0) arr.splice(i, 1); else arr.push(val);
  queueSave();
}

// One write at a time to my doc; rapid taps coalesce into one write.
let saveTimer = null;
let saving = false;
let dirty = false;
function queueSave() {
  dirty = true;
  status.saving = 'กำลังบันทึก…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 450);
}
function flushNow() { if (dirty) { clearTimeout(saveTimer); flush(); } }
async function flush() {
  if (saving || !meKey.value) return;
  saving = true;
  let ok = true;
  while (dirty) {
    dirty = false;
    const body = {
      name: meName.value, dates: [...me.dates], voteDates: [...me.voteDates], votePlaces: [...me.votePlaces], updatedAt: Date.now(),
    };
    try { await setDoc(doc(db, 'people', meKey.value), body); } catch (e) { ok = false; writeError(e); }
  }
  saving = false;
  status.saving = ok ? 'บันทึกแล้ว' : '';
  if (ok) setTimeout(() => { if (!saving && !dirty) status.saving = ''; }, 1500);
}
window.addEventListener('pagehide', flushNow);

function writeError(e) {
  console.error(e);
  const code = e && e.code;
  if (code === 'permission-denied') say('บันทึกไม่ได้ ข้อมูลไม่ผ่านเงื่อนไข (เช่น ชื่อยาวเกินไป)');
  else if (code === 'resource-exhausted') say('ใช้งานเกินโควตาฟรีของวันนี้แล้ว ลองใหม่พรุ่งนี้');
  else if (code === 'unavailable') say('เน็ตหลุด จะบันทึกให้เมื่อกลับมาออนไลน์');
  else say('บันทึกไม่สำเร็จ ลองอีกครั้ง');
}

// ---------- places ----------
export async function addPlace({ title, url, note }) {
  if (!canEdit()) return false;
  try {
    await addDoc(collection(db, 'places'), {
      title: title.slice(0, 80), url, note: note.slice(0, 300), by: meName.value, byKey: meKey.value, createdAt: Date.now(),
    });
    say('เพิ่ม ' + title + ' แล้ว');
    return true;
  } catch (e) { writeError(e); return false; }
}

export async function removePlace(p) {
  if (!canEdit()) return;
  try {
    await deleteDoc(doc(db, 'places', p.id));
    const i = me.votePlaces.indexOf(p.id);
    if (i >= 0) { me.votePlaces.splice(i, 1); queueSave(); }
    say('ลบ ' + p.title + ' แล้ว');
  } catch (e) { writeError(e); }
}

// ---------- reset ----------
export async function resetAll() {
  const refs = [];
  for (const name of ['people', 'places']) {
    const snap = await getDocs(collection(db, name));
    snap.forEach((d) => refs.push(d.ref));
  }
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  dirty = false;
  clearTimeout(saveTimer);
  me.dates.splice(0); me.voteDates.splice(0); me.votePlaces.splice(0);
  say('เริ่มนัดรอบใหม่แล้ว');
}

// ---------- live data ----------
export function connect() {
  const fail = (e) => {
    console.error(e);
    status.connected = false;
    status.error = e && e.code === 'permission-denied'
      ? 'ฐานข้อมูลยังไม่เปิดให้อ่าน ตรวจ Firestore rules อีกครั้ง'
      : 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองรีเฟรชหน้า';
  };
  onSnapshot(collection(db, 'people'), (s) => {
    status.connected = true;
    status.error = '';
    peopleDocs.value = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (meKey.value && !dirty && !saving) syncMeFromStore();
  }, fail);
  onSnapshot(collection(db, 'places'), (s) => {
    placeDocs.value = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, fail);
}
