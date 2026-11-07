// v2 state and every Firestore/Auth call. Views import from here; they never touch Firebase directly.
import { reactive, ref, computed, watch } from 'vue';
import {
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, writeBatch,
  serverTimestamp, increment, arrayUnion, query, orderBy,
} from 'firebase/firestore';
import {
  onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut,
} from 'firebase/auth';
import { db, auth } from './firebase.js';
import { newRoomCode, newGuestCode, newPid, isRoomCode, isGuestCode } from './lib/codes.js';
import { keyOfDate, startOfToday } from '../../src/lib/dates.js';

export const today = startOfToday();
export const todayKey = keyOfDate(today);

// ------------------------------------------------------------------ messages
const toastState = reactive({ text: '', kind: '', t: null });
export const toast = computed(() => toastState);
export function say(text, kind = '') {
  toastState.text = text;
  toastState.kind = kind;
  clearTimeout(toastState.t);
  toastState.t = setTimeout(() => { toastState.text = ''; }, 3200);
}

/** Turn a Firebase error into a sentence that says what to do. */
export function explain(e) {
  console.error(e);
  const code = (e && e.code) || '';
  if (code.includes('permission-denied')) return 'ทำไม่ได้: คุณไม่มีสิทธิ์ หรือถูกนำออกจากห้องนี้แล้ว';
  if (code.includes('unavailable')) return 'เน็ตหลุด ระบบจะบันทึกให้เมื่อกลับมาออนไลน์';
  if (code.includes('resource-exhausted')) return 'ใช้งานเกินโควตาฟรีของวันนี้แล้ว ลองใหม่พรุ่งนี้';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'ยกเลิกการเข้าสู่ระบบแล้ว';
  if (code.includes('popup-blocked')) return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาต pop-up แล้วลองอีกครั้ง';
  if (code.includes('app-check')) return 'เบราว์เซอร์นี้ยืนยันตัวไม่ผ่าน ลองปิดตัวบล็อกโฆษณาแล้วรีเฟรช';
  return e && e.message && !code ? e.message : 'มีบางอย่างผิดพลาด ลองอีกครั้ง';
}

// ------------------------------------------------------------------ local memory (guest rooms)
const LS_KEY = 'wangmai.v2.rooms';
function readLocalRooms() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function writeLocalRooms(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}
export const localRooms = ref(readLocalRooms());
function rememberRoom(roomId, name, as) {
  const list = localRooms.value.filter((r) => r.roomId !== roomId);
  list.unshift({ roomId, name, as });
  localRooms.value = list.slice(0, 20);
  writeLocalRooms(localRooms.value);
}
export function forgetRoom(roomId) {
  localRooms.value = localRooms.value.filter((r) => r.roomId !== roomId);
  writeLocalRooms(localRooms.value);
}

// ------------------------------------------------------------------ auth + profile
export const session = reactive({ ready: false, user: null, profile: null, profileLoaded: false });
export const isGoogle = computed(() => !!session.user && !session.user.isAnonymous);
let unsubProfile = null;

onAuthStateChanged(auth, (user) => {
  session.user = user;
  session.ready = true;
  session.profile = null;
  session.profileLoaded = false;
  if (unsubProfile) { unsubProfile(); unsubProfile = null; }
  if (user && !user.isAnonymous) {
    unsubProfile = onSnapshot(doc(db, 'users', user.uid), (s) => {
      session.profile = s.exists() ? s.data() : null;
      session.profileLoaded = true;
    }, (e) => { session.profileLoaded = true; say(explain(e), 'error'); });
  }
});

export async function signInGoogle() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { say(explain(e), 'error'); }
}

export async function signOut() {
  stopRoom();
  await fbSignOut(auth);
  location.hash = '';
}

export async function saveProfile(name, color) {
  const uid = session.user.uid;
  const ref_ = doc(db, 'users', uid);
  if (session.profile) await updateDoc(ref_, { name, color });
  else await setDoc(ref_, { name, color, roomCount: 0, rooms: [], createdAt: serverTimestamp() });
}

async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// ------------------------------------------------------------------ rooms: create / join
export async function createRoom(name) {
  const uid = session.user.uid;
  const p = session.profile;
  const roomRef = doc(collection(db, 'rooms'));
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newRoomCode();
    const b = writeBatch(db);
    b.update(doc(db, 'users', uid), { roomCount: increment(1), rooms: arrayUnion(roomRef.id) });
    b.set(roomRef, { name, ownerUid: uid, joinCode: code, createdAt: serverTimestamp() });
    b.set(doc(db, 'joinCodes', code), { roomId: roomRef.id });
    b.set(doc(db, 'rooms', roomRef.id, 'members', uid), {
      name: p.name, color: p.color, kind: 'member', role: 'owner', status: 'active', pid: uid, joinCode: code, joinedAt: serverTimestamp(),
    });
    try {
      await b.commit();
      return roomRef.id;
    } catch (e) {
      // A taken code looks like permission-denied (joinCodes cannot be overwritten): try another code.
      if (attempt === 2) throw e;
    }
  }
  return null;
}

async function roomIdForCode(code) {
  const s = await getDoc(doc(db, 'joinCodes', code));
  return s.exists() ? s.data().roomId : null;
}

/** Google member joins with a room code. Returns roomId or throws with a readable message. */
export async function joinWithRoomCode(code) {
  if (!isRoomCode(code)) throw new Error('รหัสห้องต้องมี 6 ตัว');
  const roomId = await roomIdForCode(code);
  if (!roomId) throw new Error('ไม่พบห้องนี้ ลองตรวจรหัสอีกครั้ง');
  const uid = session.user.uid;
  const mine = doc(db, 'rooms', roomId, 'members', uid);
  let already = false;
  try { already = (await getDoc(mine)).exists(); } catch { already = false; }
  if (!already) {
    const p = session.profile;
    await setDoc(mine, {
      name: p.name, color: p.color, kind: 'member', role: 'participant', status: 'active', pid: uid, joinCode: code, joinedAt: serverTimestamp(),
    });
  }
  await updateDoc(doc(db, 'users', uid), { rooms: arrayUnion(roomId) });
  return roomId;
}

/** Guest (or anyone holding a personal code) claims their invite. Returns roomId. */
export async function joinWithGuestCode(roomCode, guestCode) {
  if (!isRoomCode(roomCode)) throw new Error('รหัสห้องต้องมี 6 ตัว');
  if (!isGuestCode(guestCode)) throw new Error('รหัสส่วนตัวต้องมี 8 ตัว');
  const user = await ensureSignedIn();
  const roomId = await roomIdForCode(roomCode);
  if (!roomId) throw new Error('ไม่พบห้องนี้ ลองตรวจรหัสอีกครั้ง');
  const invSnap = await getDoc(doc(db, 'rooms', roomId, 'invites', guestCode));
  if (!invSnap.exists()) throw new Error('รหัสส่วนตัวนี้ใช้ไม่ได้ ขอรหัสใหม่จากเจ้าของห้อง');
  const inv = invSnap.data();
  const inviteRef = doc(db, 'rooms', roomId, 'invites', guestCode);
  const mine = doc(db, 'rooms', roomId, 'members', user.uid);
  const first = writeBatch(db);
  first.update(inviteRef, { claimedBy: user.uid });
  first.set(mine, {
    name: inv.name, color: inv.color, kind: 'guest', role: 'participant', status: 'active', pid: inv.pid, inviteCode: guestCode, joinedAt: serverTimestamp(),
  });
  try {
    await first.commit();
  } catch {
    // This browser joined before (its member doc exists): taking the code back is enough.
    await updateDoc(inviteRef, { claimedBy: user.uid });
  }
  rememberRoom(roomId, '', inv.name);
  return roomId;
}

// ------------------------------------------------------------------ current room (live)
export const room = reactive({
  id: '', data: null, members: [], meetups: [], invites: [], error: '', loaded: false,
});
const unsubs = [];
function stopRoom() {
  while (unsubs.length) unsubs.pop()();
  stopMeetup();
  Object.assign(room, { id: '', data: null, members: [], meetups: [], invites: [], error: '', loaded: false });
}

export function openRoom(roomId) {
  if (room.id === roomId) return;
  stopRoom();
  room.id = roomId;
  const fail = (e) => { room.error = explain(e); room.loaded = true; };
  unsubs.push(onSnapshot(doc(db, 'rooms', roomId), (s) => {
    room.data = s.exists() ? { id: s.id, ...s.data() } : null;
    room.loaded = true;
    if (room.data) {
      const me = myMember.value;
      rememberRoomName(roomId, room.data.name, me && me.name);
    }
  }, fail));
  unsubs.push(onSnapshot(collection(db, 'rooms', roomId, 'members'), (s) => {
    room.members = s.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }, fail));
  unsubs.push(onSnapshot(query(collection(db, 'rooms', roomId, 'meetups'), orderBy('createdAt', 'desc')), (s) => {
    room.meetups = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, fail));
}

function rememberRoomName(roomId, name, as) {
  if (session.user && session.user.isAnonymous) rememberRoom(roomId, name, as || '');
}

/** Start listening to invites (hosts only). */
export function watchInvites() {
  if (!room.id) return;
  unsubs.push(onSnapshot(collection(db, 'rooms', room.id, 'invites'), (s) => {
    room.invites = s.docs.map((d) => ({ code: d.id, ...d.data() }));
  }, () => {}));
}

export const myMember = computed(() => {
  const u = session.user;
  return u ? room.members.find((m) => m.uid === u.uid) || null : null;
});
export const isHost = computed(() => !!myMember.value && ['owner', 'cohost'].includes(myMember.value.role) && myMember.value.status === 'active');
export const isOwner = computed(() => !!myMember.value && myMember.value.role === 'owner');

/** One entry per person (pid). A guest who moved devices keeps only the newest member doc. */
export const people = computed(() => {
  const byPid = new Map();
  for (const m of room.members) {
    if (m.status !== 'active') continue;
    const prev = byPid.get(m.pid);
    const t = (x) => (x.joinedAt && x.joinedAt.toMillis ? x.joinedAt.toMillis() : 0);
    if (!prev || t(m) > t(prev)) byPid.set(m.pid, m);
  }
  const order = { owner: 0, cohost: 1, participant: 2 };
  return [...byPid.values()].sort((a, b) => (order[a.role] - order[b.role]) || a.name.localeCompare(b.name, 'th'));
});

// ------------------------------------------------------------------ room admin
export async function renameRoom(name) {
  await updateDoc(doc(db, 'rooms', room.id), { name });
}

export async function rotateRoomCode() {
  const old = room.data.joinCode;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newRoomCode();
    const b = writeBatch(db);
    b.set(doc(db, 'joinCodes', code), { roomId: room.id });
    b.update(doc(db, 'rooms', room.id), { joinCode: code });
    b.delete(doc(db, 'joinCodes', old));
    try { await b.commit(); return code; } catch (e) { if (attempt === 2) throw e; }
  }
  return null;
}

export async function createInvite(name, color) {
  const pid = newPid();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newGuestCode();
    try {
      await setDoc(doc(db, 'rooms', room.id, 'invites', code), {
        name, color, pid, claimedBy: null, createdBy: session.user.uid, createdAt: serverTimestamp(),
      });
      return code;
    } catch (e) { if (attempt === 2) throw e; }
  }
  return null;
}

export async function deleteInvite(code) {
  await deleteDoc(doc(db, 'rooms', room.id, 'invites', code));
}

export async function setRole(m, role) {
  await updateDoc(doc(db, 'rooms', room.id, 'members', m.uid), { role });
}

/** Block: the person loses access and cannot come back. Guests also lose their personal code. */
export async function blockMember(m) {
  const b = writeBatch(db);
  b.update(doc(db, 'rooms', room.id, 'members', m.uid), { status: 'blocked', role: 'participant' });
  if (m.kind === 'guest' && m.inviteCode) b.delete(doc(db, 'rooms', room.id, 'invites', m.inviteCode));
  await b.commit();
}

export async function unblockMember(m) {
  await updateDoc(doc(db, 'rooms', room.id, 'members', m.uid), { status: 'active' });
}

/** Remove: a Google member can rejoin with the room code; for guests this is the same as revoking their code. */
export async function removeMember(m) {
  const b = writeBatch(db);
  b.delete(doc(db, 'rooms', room.id, 'members', m.uid));
  if (m.kind === 'guest' && m.inviteCode) b.delete(doc(db, 'rooms', room.id, 'invites', m.inviteCode));
  await b.commit();
}

export async function leaveRoom() {
  await deleteDoc(doc(db, 'rooms', room.id, 'members', session.user.uid));
  forgetRoom(room.id);
}

export async function deleteRoom() {
  const id = room.id;
  const code = room.data.joinCode;
  const b = writeBatch(db);
  b.delete(doc(db, 'joinCodes', code));
  b.delete(doc(db, 'rooms', id));
  await b.commit();
  forgetRoom(id);
}

// ------------------------------------------------------------------ meetups
export async function createMeetup(title) {
  const r = await addDoc(collection(db, 'rooms', room.id, 'meetups'), {
    title, status: 'open', result: null, drawCount: { date: 0, place: 0 }, createdBy: session.user.uid, createdAt: serverTimestamp(),
  });
  return r.id;
}

export const meetup = reactive({
  id: '', data: null, avail: [], places: [], draws: [], loaded: false,
});
const meetUnsubs = [];
function stopMeetup() {
  while (meetUnsubs.length) meetUnsubs.pop()();
  flushNow();
  Object.assign(meetup, { id: '', data: null, avail: [], places: [], draws: [], loaded: false });
}

export function openMeetup(roomId, meetId) {
  openRoom(roomId);
  if (meetup.id === meetId) return;
  stopMeetup();
  meetup.id = meetId;
  const base = ['rooms', roomId, 'meetups', meetId];
  const fail = (e) => say(explain(e), 'error');
  meetUnsubs.push(onSnapshot(doc(db, ...base), (s) => {
    meetup.data = s.exists() ? { id: s.id, ...s.data() } : null;
    meetup.loaded = true;
  }, fail));
  meetUnsubs.push(onSnapshot(collection(db, ...base, 'avail'), (s) => {
    meetup.avail = s.docs.map((d) => ({ pid: d.id, ...d.data() }));
    if (!dirty && !saving) syncMine();
  }, fail));
  meetUnsubs.push(onSnapshot(query(collection(db, ...base, 'places'), orderBy('createdAt', 'asc')), (s) => {
    meetup.places = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, fail));
  meetUnsubs.push(onSnapshot(query(collection(db, ...base, 'draws'), orderBy('at', 'desc')), (s) => {
    meetup.draws = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, fail));
}

// Re-read my saved entry once I know which person I am in this room.
watch(() => myMember.value && myMember.value.pid, () => { if (!dirty && !saving) syncMine(); });

export const isOpen = computed(() => !!meetup.data && meetup.data.status === 'open');

// ----- my availability: edited locally, saved as one coalesced write -----
const split = (s) => (s ? s.split(',') : []);
export const mine = reactive({ dates: [], voteDates: [], votePlaces: [], hidden: false });
function syncMine() {
  const pid = myMember.value && myMember.value.pid;
  const a = meetup.avail.find((x) => x.pid === pid);
  mine.dates = a ? split(a.dates) : [];
  mine.voteDates = a ? split(a.voteDates) : [];
  mine.votePlaces = a ? [...(a.votePlaces || [])] : [];
  mine.hidden = a ? !!a.hidden : false;
}

let saveTimer = null; let saving = false; let dirty = false;
export const saveState = ref('');
function queueSave() {
  dirty = true;
  saveState.value = 'กำลังบันทึก…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}
function flushNow() { if (dirty) { clearTimeout(saveTimer); flush(); } }
async function flush() {
  const me = myMember.value;
  if (saving || !me || !meetup.id) return;
  saving = true;
  let ok = true;
  while (dirty) {
    dirty = false;
    try {
      await setDoc(doc(db, 'rooms', room.id, 'meetups', meetup.id, 'avail', me.pid), {
        dates: [...mine.dates].sort().join(','),
        voteDates: [...mine.voteDates].sort().join(','),
        votePlaces: [...mine.votePlaces],
        hidden: mine.hidden,
        updatedAt: serverTimestamp(),
      });
    } catch (e) { ok = false; say(explain(e), 'error'); }
  }
  saving = false;
  saveState.value = ok ? 'บันทึกแล้ว' : '';
  if (ok) setTimeout(() => { if (!dirty && !saving) saveState.value = ''; }, 1500);
}
window.addEventListener('pagehide', flushNow);

function canEdit() {
  if (!isOpen.value) { say('นัดนี้สรุปแล้ว แก้ไม่ได้'); return false; }
  if (!myMember.value) { say('ต้องเข้าห้องก่อน'); return false; }
  return true;
}

export function toggleDate(k) {
  if (!canEdit()) return;
  const i = mine.dates.indexOf(k);
  if (i >= 0) mine.dates.splice(i, 1); else mine.dates.push(k);
  queueSave();
}

export function setDates(keys, add) {
  if (!canEdit()) return 0;
  const set = new Set(mine.dates);
  let n = 0;
  for (const k of keys) {
    if (add && !set.has(k)) { set.add(k); n++; }
    if (!add && set.has(k)) { set.delete(k); n++; }
  }
  if (n) { mine.dates = [...set].sort(); queueSave(); }
  return n;
}

export function toggleVote(field, value) {
  if (!canEdit()) return;
  const arr = mine[field];
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1); else arr.push(value);
  queueSave();
}

// ----- derived views of the meetup -----
/** People counted in this meetup: active, not hidden by a host. Mine merged from local edits. */
export const meetPeople = computed(() => {
  const hidden = new Set(meetup.avail.filter((a) => a.hidden).map((a) => a.pid));
  return people.value.filter((p) => !hidden.has(p.pid));
});

const availFor = (pid) => {
  if (myMember.value && pid === myMember.value.pid) return { dates: mine.dates, voteDates: mine.voteDates, votePlaces: mine.votePlaces };
  const a = meetup.avail.find((x) => x.pid === pid);
  return a ? { dates: split(a.dates), voteDates: split(a.voteDates), votePlaces: a.votePlaces || [] } : { dates: [], voteDates: [], votePlaces: [] };
};

/** date → people (in member order) who are free */
export const freeByDate = computed(() => {
  const m = {};
  for (const p of meetPeople.value) for (const d of availFor(p.pid).dates) (m[d] = m[d] || []).push(p);
  return m;
});

export const goldDates = computed(() => {
  const n = meetPeople.value.length;
  if (n < 2) return [];
  return Object.keys(freeByDate.value).filter((d) => d >= todayKey && freeByDate.value[d].length === n).sort();
});

export const topDates = computed(() => {
  const votes = {};
  for (const p of meetPeople.value) for (const d of availFor(p.pid).voteDates) (votes[d] = votes[d] || []).push(p);
  const keys = new Set([...Object.keys(freeByDate.value), ...Object.keys(votes)]);
  return [...keys].filter((d) => d >= todayKey)
    .map((d) => ({ date: d, free: freeByDate.value[d] || [], votes: votes[d] || [] }))
    .sort((a, b) => (b.votes.length - a.votes.length) || (b.free.length - a.free.length) || a.date.localeCompare(b.date))
    .slice(0, 12);
});

export const placesRanked = computed(() => {
  const votes = {};
  for (const p of meetPeople.value) for (const id of availFor(p.pid).votePlaces) (votes[id] = votes[id] || []).push(p);
  const n = meetPeople.value.length;
  return meetup.places
    .map((pl) => ({ ...pl, votes: votes[pl.id] || [], gold: n > 1 && (votes[pl.id] || []).length === n }))
    .sort((a, b) => b.votes.length - a.votes.length);
});

export const personByPid = computed(() => {
  const m = new Map();
  for (const x of room.members) m.set(x.pid, x);
  return m;
});

// ----- places -----
export async function addPlace({ title, mapsUrl, note }) {
  if (!canEdit()) return false;
  await addDoc(collection(db, 'rooms', room.id, 'meetups', meetup.id, 'places'), {
    title, mapsUrl, gPlaceId: '', address: '', note, pid: myMember.value.pid, createdAt: serverTimestamp(),
  });
  return true;
}

export async function removePlace(pl) {
  await deleteDoc(doc(db, 'rooms', room.id, 'meetups', meetup.id, 'places', pl.id));
  const i = mine.votePlaces.indexOf(pl.id);
  if (i >= 0) { mine.votePlaces.splice(i, 1); queueSave(); }
}

// ----- hide someone for this meetup (hosts) -----
export async function setHidden(pid, hidden) {
  await updateDoc(doc(db, 'rooms', room.id, 'meetups', meetup.id, 'avail', pid), { hidden });
}

// ----- random draw (hosts): evidence is append-only, max 3 per kind -----
export async function draw(kind, candidates) {
  const used = meetup.data.drawCount[kind] || 0;
  if (used >= 3) throw new Error('สุ่มครบ 3 ครั้งแล้ว');
  if (candidates.length < 2) throw new Error('เลือกอย่างน้อย 2 ตัวเลือก');
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const result = candidates[buf[0] % candidates.length];
  const n = used + 1;
  const base = ['rooms', room.id, 'meetups', meetup.id];
  const b = writeBatch(db);
  b.update(doc(db, ...base), { ['drawCount.' + kind]: n });
  b.set(doc(collection(db, ...base, 'draws')), { kind, candidates, result, n, pid: myMember.value.pid, at: serverTimestamp() });
  await b.commit();
  return result;
}

// ----- conclude / reopen (hosts) -----
export async function concludeMeetup({ date, placeId, via }) {
  const pl = meetup.places.find((p) => p.id === placeId);
  await updateDoc(doc(db, 'rooms', room.id, 'meetups', meetup.id), {
    status: 'done',
    result: { date: date || '', placeId: placeId || '', placeTitle: pl ? pl.title : '', placeUrl: pl ? pl.mapsUrl : '', via },
  });
}

export async function reopenMeetup() {
  await updateDoc(doc(db, 'rooms', room.id, 'meetups', meetup.id), { status: 'open', result: null });
}

export async function renameMeetup(title) {
  await updateDoc(doc(db, 'rooms', room.id, 'meetups', meetup.id), { title });
}

// ------------------------------------------------------------------ member's room list
export const myRooms = reactive({ list: [], loading: false });
export async function loadMyRooms() {
  const ids = (session.profile && session.profile.rooms) || [];
  myRooms.loading = true;
  const out = [];
  for (const id of ids) {
    try {
      const s = await getDoc(doc(db, 'rooms', id));
      if (s.exists()) out.push({ id, ...s.data() });
    } catch { /* removed or blocked: skip */ }
  }
  myRooms.list = out;
  myRooms.loading = false;
}
