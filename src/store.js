// App state and every Firestore/Auth call. Views import from here; they never touch Firebase directly.
import { reactive, ref, computed, watch } from 'vue';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, writeBatch,
  serverTimestamp, increment, arrayUnion, query, orderBy,
} from 'firebase/firestore';
import {
  onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut,
} from 'firebase/auth';
import { db, auth } from './firebase.js';
import { pickColor } from './lib/palette.js';
import { newRoomCode, newGuestCode, newPid, isRoomCode, isGuestCode } from './lib/codes.js';
import { keyOfDate, startOfToday } from './lib/dates.js';

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
  if (code.includes('permission-denied')) return 'ทำไม่ได้: คุณไม่มีสิทธิ์ หรือถูกนำออกจากแก๊งนี้แล้ว';
  if (code.includes('unavailable')) return 'เน็ตหลุด ระบบจะบันทึกให้เมื่อกลับมาออนไลน์';
  if (code.includes('resource-exhausted')) return 'ใช้งานเกินโควตาฟรีของวันนี้แล้ว ลองใหม่พรุ่งนี้';
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'ยกเลิกการเข้าสู่ระบบแล้ว';
  if (code.includes('popup-blocked')) return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาต pop-up แล้วลองอีกครั้ง';
  if (code.includes('app-check')) return 'เบราว์เซอร์นี้ยืนยันตัวไม่ผ่าน ลองปิดตัวบล็อกโฆษณาแล้วรีเฟรช';
  return e && e.message && !code ? e.message : 'มีบางอย่างผิดพลาด ลองอีกครั้ง';
}

// ------------------------------------------------------------------ local memory (gangs joined without Google)
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
const PENDING_KEY = 'wangmai.pendingGang';
export const pendingGang = ref((() => { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; } })());
export function setPendingGang(v) {
  pendingGang.value = v;
  try { if (v) localStorage.setItem(PENDING_KEY, JSON.stringify(v)); else localStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
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
    b.set(doc(db, 'joinCodes', code), { roomId: roomRef.id, name });
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

/** What a gang link points to: { roomId, name } or null. Needs any sign-in. */
export async function peekGangLink(code) {
  await ensureSignedIn();
  const s = await getDoc(doc(db, 'joinCodes', code));
  return s.exists() ? { roomId: s.data().roomId, name: s.data().name || '' } : null;
}

/** Am I already in this gang? */
export async function isInGang(roomId) {
  if (!session.user) return false;
  try {
    const s = await getDoc(doc(db, 'rooms', roomId, 'members', session.user.uid));
    return s.exists() && s.data().status === 'active';
  } catch { return false; }
}

/** Google member joins with a room code. Returns roomId or throws with a readable message. */
export async function joinWithRoomCode(code) {
  if (!isRoomCode(code)) throw new Error('รหัสแก๊งต้องมี 6 ตัว');
  const roomId = await roomIdForCode(code);
  if (!roomId) throw new Error('ไม่พบแก๊งนี้ ลองตรวจรหัสอีกครั้ง');
  const uid = session.user.uid;
  const mine = doc(db, 'rooms', roomId, 'members', uid);
  let already = false;
  try { already = (await getDoc(mine)).exists(); } catch { already = false; }
  if (!already) {
    const p = session.profile;
    await setDoc(mine, {
      name: p.name, color: p.color, kind: 'member', role: 'participant', status: 'active', pid: uid, joinCode: code, joinedAt: serverTimestamp(),
    });
    // The profile colour is only a default: if someone here already has it, take a free one for this room.
    try {
      const others = (await getDocs(collection(db, 'rooms', roomId, 'members'))).docs
        .map((d) => d.data()).filter((m) => m.status === 'active' && m.pid !== uid);
      const color = pickColor(p.color, others.map((m) => m.color));
      if (color !== p.color) await updateDoc(mine, { color });
    } catch { /* joined anyway; the colour can be changed in จัดการแก๊ง */ }
  }
  await updateDoc(doc(db, 'users', uid), { rooms: arrayUnion(roomId) });
  return roomId;
}

/** Guest (or anyone holding a personal code) claims their invite. Returns roomId. */
export async function joinWithGuestCode(roomCode, guestCode) {
  if (!isRoomCode(roomCode)) throw new Error('รหัสแก๊งต้องมี 6 ตัว');
  if (!isGuestCode(guestCode)) throw new Error('รหัสส่วนตัวต้องมี 8 ตัว');
  const user = await ensureSignedIn();
  const roomId = await roomIdForCode(roomCode);
  if (!roomId) throw new Error('ไม่พบแก๊งนี้ ลองตรวจรหัสอีกครั้ง');
  const invSnap = await getDoc(doc(db, 'rooms', roomId, 'invites', guestCode));
  if (!invSnap.exists()) throw new Error('ลิงก์ส่วนตัวนี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่จากคนที่ชวน');
  const inv = invSnap.data();
  const inviteRef = doc(db, 'rooms', roomId, 'invites', guestCode);
  const mine = doc(db, 'rooms', roomId, 'members', user.uid);
  const first = writeBatch(db);
  first.update(inviteRef, { claimedBy: user.uid });
  first.set(mine, {
    name: inv.name, color: inv.color, kind: 'guest', role: 'participant', status: 'active', pid: inv.pid, inviteCode: guestCode, joinedAt: serverTimestamp(),
    ...(inv.meetId ? { meetId: inv.meetId } : {}),
  });
  try {
    await first.commit();
  } catch {
    // This browser joined before (its member doc exists): taking the code back is enough.
    await updateDoc(inviteRef, { claimedBy: user.uid });
  }
  rememberRoom(roomId, '', inv.name);
  // Signed in with Google: keep this gang (or meetup) in the account's history too.
  if (!user.isAnonymous && session.profile) {
    try { await updateDoc(doc(db, 'users', user.uid), { rooms: arrayUnion(roomId) }); } catch { /* history only */ }
  }
  return { roomId, meetId: inv.meetId || '' };
}

// ------------------------------------------------------------------ current room (live)
export const room = reactive({
  id: '', data: null, members: [], meetups: [], invites: [], error: '', loaded: false,
});
const unsubs = [];
let meetupsUnsub = null;
let meetupsScope = null;
function stopRoom() {
  while (unsubs.length) unsubs.pop()();
  if (meetupsUnsub) { meetupsUnsub(); meetupsUnsub = null; }
  meetupsScope = null;
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
    watchMeetups(fail);
  }, fail));
}

/** Everyone in the gang sees all meetups; a meetup-only guest sees just theirs (rules enforce the same). */
function watchMeetups(fail) {
  const me = myMember.value;
  if (!me) return;
  const scope = me.meetId || '';
  if (meetupsUnsub && scope === meetupsScope) return;
  if (meetupsUnsub) meetupsUnsub();
  meetupsScope = scope;
  meetupsUnsub = scope
    ? onSnapshot(doc(db, 'rooms', room.id, 'meetups', scope), (s) => {
      room.meetups = s.exists() ? [{ id: s.id, ...s.data() }] : [];
    }, fail)
    : onSnapshot(query(collection(db, 'rooms', room.id, 'meetups'), orderBy('createdAt', 'desc')), (s) => {
      room.meetups = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    }, fail);
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
/** In the gang itself (not only a guest of one meetup). */
export const inGang = computed(() => !!myMember.value && myMember.value.status === 'active' && !myMember.value.meetId);
export const ROLE_LABEL = { owner: 'ผู้สร้างแก๊ง', cohost: 'ผู้ดูแลแก๊ง', participant: 'สมาชิกแก๊ง' };

/** One entry per person (pid): someone who opened their personal link on several devices has one member doc per device. */
function onePerPerson(members) {
  const byPid = new Map();
  const t = (x) => (x.joinedAt && x.joinedAt.toMillis ? x.joinedAt.toMillis() : 0);
  for (const m of members) {
    if (m.status !== 'active') continue;
    const prev = byPid.get(m.pid);
    if (!prev || t(m) > t(prev)) byPid.set(m.pid, m);
  }
  const order = { owner: 0, cohost: 1, participant: 2 };
  return [...byPid.values()].sort((a, b) => (order[a.role] - order[b.role]) || a.name.localeCompare(b.name, 'th'));
}
export const people = computed(() => onePerPerson(room.members));

// ------------------------------------------------------------------ room admin
export async function renameRoom(name) {
  const b = writeBatch(db);
  b.update(doc(db, 'rooms', room.id), { name });
  b.update(doc(db, 'joinCodes', room.data.joinCode), { name });
  await b.commit();
}

export const gangLink = (code) => location.origin + location.pathname + '#g-' + code;
export const guestLink = (code) => location.origin + location.pathname + '#j-' + room.data.joinCode + '-' + code;
export const meetupLink = (meetId) => location.origin + location.pathname + '#m-' + room.id + '-' + meetId;

export async function rotateRoomCode() {
  const old = room.data.joinCode;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newRoomCode();
    const b = writeBatch(db);
    b.set(doc(db, 'joinCodes', code), { roomId: room.id, name: room.data.name });
    b.update(doc(db, 'rooms', room.id), { joinCode: code });
    b.delete(doc(db, 'joinCodes', old));
    try { await b.commit(); return code; } catch (e) { if (attempt === 2) throw e; }
  }
  return null;
}

export async function createInvite(name, color, meetId = null) {
  const pid = newPid();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newGuestCode();
    try {
      await setDoc(doc(db, 'rooms', room.id, 'invites', code), {
        name, color, pid, claimedBy: null, createdBy: session.user.uid, createdAt: serverTimestamp(), ...(meetId ? { meetId } : {}),
      });
      return code;
    } catch (e) { if (attempt === 2) throw e; }
  }
  return null;
}

export async function deleteInvite(code) {
  await deleteDoc(doc(db, 'rooms', room.id, 'invites', code));
}

/** Colours other people in the current room already have. */
export const takenColors = computed(() => {
  const me = myMember.value;
  return people.value.filter((p) => !me || p.pid !== me.pid).map((p) => p.color);
});

/** Change my colour in this room only (Google members; a guest's colour is set by the host). */
export async function setMyColor(color) {
  await updateDoc(doc(db, 'rooms', room.id, 'members', session.user.uid), { color });
}

/**
 * Make someone a guest of one meetup (meetId) or a member of the gang (null), on every device they used,
 * and keep their personal link in step so a new device gets the same scope.
 */
export async function setScope(m, meetId) {
  const b = writeBatch(db);
  for (const x of room.members.filter((y) => y.pid === m.pid)) b.update(doc(db, 'rooms', room.id, 'members', x.uid), { meetId: meetId || null });
  if (m.kind === 'guest' && m.inviteCode) b.update(doc(db, 'rooms', room.id, 'invites', m.inviteCode), { meetId: meetId || null });
  await b.commit();
}

export async function setInviteScope(code, meetId) {
  await updateDoc(doc(db, 'rooms', room.id, 'invites', code), { meetId: meetId || null });
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

/** Remove: a Google member can rejoin with the gang link; for guests this is the same as revoking their code. */
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
/** Any gang member starts a meetup ("ถามว่าว่างไหม?") and runs it. */
export async function createMeetup(roomId, title) {
  const me = (await getDoc(doc(db, 'rooms', roomId, 'members', session.user.uid))).data();
  const r = await addDoc(collection(db, 'rooms', roomId, 'meetups'), {
    title, status: 'open', result: null, drawCount: { date: 0, place: 0 }, createdBy: me.pid, createdAt: serverTimestamp(),
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

/** Set right after "ถามว่าว่างไหม?" creates a meetup, so its page opens "ส่งให้เพื่อน". */
export const askedMeetup = ref('');

export const isOpen = computed(() => !!meetup.data && meetup.data.status === 'open');
/** Runs this meetup: its creator, or the gang's owner and co-hosts. */
export const canRun = computed(() => isHost.value
  || (inGang.value && !!meetup.data && meetup.data.createdBy === myMember.value.pid));

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
  if (!isOpen.value) { say('นัดนี้ปิดแล้ว แก้ไม่ได้'); return false; }
  if (!myMember.value) { say('ต้องเข้าแก๊งก่อน'); return false; }
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
/** Everyone who belongs to this meetup: the gang plus this meetup's guests. */
export const meetRoster = computed(() => people.value.filter((p) => !p.meetId || p.meetId === meetup.id));

/** People counted in this meetup: the roster minus anyone a host hid. Mine merged from local edits. */
export const meetPeople = computed(() => {
  const hidden = new Set(meetup.avail.filter((a) => a.hidden).map((a) => a.pid));
  return meetRoster.value.filter((p) => !hidden.has(p.pid));
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

/** People in this meetup who have not marked any free day yet. */
export const notYet = computed(() => meetPeople.value.filter((p) => !availFor(p.pid).dates.length));

// ----- hide someone for this meetup (whoever runs it) -----
export async function setHidden(pid, hidden) {
  const ref_ = doc(db, 'rooms', room.id, 'meetups', meetup.id, 'avail', pid);
  if (meetup.avail.some((a) => a.pid === pid)) await updateDoc(ref_, { hidden });
  else if (hidden) await setDoc(ref_, { dates: '', voteDates: '', votePlaces: [], hidden: true, updatedAt: serverTimestamp() });
}

// ----- random draw (whoever runs the meetup): evidence is append-only, max 3 per kind -----
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

// ----- decide the day and the place separately, then close (whoever runs the meetup) -----
const meetRef = () => doc(db, 'rooms', room.id, 'meetups', meetup.id);
const currentResult = () => ({ date: '', placeId: '', placeTitle: '', placeUrl: '', ...(meetup.data.result || {}) });

/** date '' clears the decision. */
export async function decideDate(date) {
  await updateDoc(meetRef(), { result: { ...currentResult(), date: date || '' } });
}

/** placeId '' clears the decision. The title and link are copied so history survives a deleted place. */
export async function decidePlace(placeId) {
  const pl = meetup.places.find((p) => p.id === placeId);
  await updateDoc(meetRef(), {
    result: { ...currentResult(), placeId: pl ? pl.id : '', placeTitle: pl ? pl.title : '', placeUrl: pl ? pl.mapsUrl : '' },
  });
}

export async function closeMeetup() {
  await updateDoc(meetRef(), { status: 'done' });
}

export async function reopenMeetup() {
  await updateDoc(meetRef(), { status: 'open' });
}

export async function deleteMeetup() {
  await deleteDoc(meetRef());
}

export async function renameMeetup(title) {
  await updateDoc(doc(db, 'rooms', room.id, 'meetups', meetup.id), { title });
}

// ------------------------------------------------------------------ home: my gangs and open meetups
export const home = reactive({ gangs: [], loading: false, loaded: false });

/**
 * Every gang I am in (Google: from my account, otherwise from this browser), with my role,
 * the people in it and its open meetups. A meetup-only guest sees just that meetup.
 */
export async function loadHome() {
  if (!session.user) return;
  const ids = [...((isGoogle.value && session.profile && session.profile.rooms) || []), ...localRooms.value.map((r) => r.roomId)];
  home.loading = true;
  const uid = session.user.uid;
  const gangs = await Promise.all([...new Set(ids)].map(async (id) => {
    try {
      const [rs, ms] = await Promise.all([getDoc(doc(db, 'rooms', id)), getDocs(collection(db, 'rooms', id, 'members'))]);
      if (!rs.exists()) return null;
      const all = ms.docs.map((d) => ({ uid: d.id, ...d.data() }));
      const me = all.find((m) => m.uid === uid && m.status === 'active');
      const members = onePerPerson(all);
      if (!me) return null;
      let meetups;
      if (me.meetId) {
        const s = await getDoc(doc(db, 'rooms', id, 'meetups', me.meetId));
        meetups = s.exists() ? [{ id: s.id, ...s.data() }] : [];
      } else {
        const q = await getDocs(query(collection(db, 'rooms', id, 'meetups'), orderBy('createdAt', 'desc')));
        meetups = q.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const gang = members.filter((m) => !m.meetId);
      return { id, name: rs.data().name, role: me.role, guestOf: me.meetId || '', me, gang, meetups };
    } catch { return null; } // removed, blocked or deleted: skip
  }));
  home.gangs = gangs.filter(Boolean);
  home.loading = false;
  home.loaded = true;
}

/** Open meetups across all my gangs, newest first. */
export const recentMeetups = computed(() => home.gangs
  .flatMap((g) => g.meetups.filter((m) => m.status === 'open').map((m) => ({ ...m, gangId: g.id, gangName: g.name })))
  .sort((a, b) => ((b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0))));

