// Firestore security rules tests. Run on the emulator:  npm test
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, increment, arrayUnion,
  query, orderBy, Timestamp,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-wangmai',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const google = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const guest = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

const ROOM = 'room1';
const CODE = 'K7QX2M';
const GUEST_CODE = 'HX4P9KTW';

async function createRoom(db, uid, { roomId = ROOM, code = CODE } = {}) {
  await setDoc(doc(db, 'users', uid), { name: 'Owner', color: 1, roomCount: 0, rooms: [], createdAt: serverTimestamp() });
  const b = writeBatch(db);
  b.update(doc(db, 'users', uid), { roomCount: increment(1), rooms: arrayUnion(roomId) });
  b.set(doc(db, 'rooms', roomId), { name: 'แก๊งมหาลัย', ownerUid: uid, joinCode: code, createdAt: serverTimestamp() });
  b.set(doc(db, 'joinCodes', code), { roomId });
  b.set(doc(db, 'rooms', roomId, 'members', uid), {
    name: 'Owner', color: 1, kind: 'member', role: 'owner', status: 'active', pid: uid, joinCode: code, joinedAt: serverTimestamp(),
  });
  return b.commit();
}

async function joinAsMember(db, uid, code = CODE) {
  return setDoc(doc(db, 'rooms', ROOM, 'members', uid), {
    name: 'Nat', color: 0, kind: 'member', role: 'participant', status: 'active', pid: uid, joinCode: code, joinedAt: serverTimestamp(),
  });
}

async function createInvite(db, hostUid, code = GUEST_CODE) {
  return setDoc(doc(db, 'rooms', ROOM, 'invites', code), {
    name: 'มอส', color: 2, pid: 'pid_mos_000000000000000', claimedBy: null, createdBy: hostUid, createdAt: serverTimestamp(),
  });
}

async function claimInvite(db, uid, code = GUEST_CODE) {
  const b = writeBatch(db);
  b.update(doc(db, 'rooms', ROOM, 'invites', code), { claimedBy: uid });
  b.set(doc(db, 'rooms', ROOM, 'members', uid), {
    name: 'มอส', color: 2, kind: 'guest', role: 'participant', status: 'active', pid: 'pid_mos_000000000000000', inviteCode: code, joinedAt: serverTimestamp(),
  });
  return b.commit();
}

async function createMeetup(db, id = 'm1') {
  return setDoc(doc(db, 'rooms', ROOM, 'meetups', id), {
    title: 'ข้าวเย็น', status: 'open', result: null, drawCount: { date: 0, place: 0 }, createdBy: 'owner', createdAt: serverTimestamp(),
  });
}

// ------------------------------------------------------------------ v1

test('v1: anyone reads and writes a well-formed person', async () => {
  const db = nobody();
  await assertSucceeds(setDoc(doc(db, 'people', 'p74657374'), { name: 'test', dates: ['2026-11-07'], voteDates: [], votePlaces: [], updatedAt: 1 }));
  await assertSucceeds(getDoc(doc(db, 'people', 'p74657374')));
});

test('v1: rejects bad shapes', async () => {
  const db = nobody();
  await assertFails(setDoc(doc(db, 'people', 'p74'), { name: 'x'.repeat(31), dates: [], voteDates: [], votePlaces: [] }));
  await assertFails(setDoc(doc(db, 'people', 'p74'), { name: 'a', dates: [], voteDates: [], votePlaces: [], extra: 1 }));
  await assertFails(setDoc(doc(db, 'people', 'NOTAKEY'), { name: 'a', dates: [], voteDates: [], votePlaces: [] }));
  await assertFails(setDoc(doc(db, 'places', 'x'), { title: 'a', url: 'javascript:alert(1)', by: 'a', byKey: 'p61' }));
});

// ------------------------------------------------------------------ rooms

test('owner creates a room in one batch and reads it', async () => {
  const db = google('owner');
  await assertSucceeds(createRoom(db, 'owner'));
  await assertSucceeds(getDoc(doc(db, 'rooms', ROOM)));
});

test('room creation must bump roomCount', async () => {
  const db = google('owner');
  await setDoc(doc(db, 'users', 'owner'), { name: 'Owner', color: 1, roomCount: 0, rooms: [], createdAt: serverTimestamp() });
  const b = writeBatch(db);
  b.set(doc(db, 'rooms', ROOM), { name: 'x', ownerUid: 'owner', joinCode: CODE, createdAt: serverTimestamp() });
  b.set(doc(db, 'joinCodes', CODE), { roomId: ROOM });
  await assertFails(b.commit());
});

test('guests cannot create rooms', async () => {
  await assertFails(createRoom(guest('g1'), 'g1'));
});

test('outsiders cannot read a room or list room codes', async () => {
  await createRoom(google('owner'), 'owner');
  await assertFails(getDoc(doc(google('stranger'), 'rooms', ROOM)));
  await assertFails(getDoc(doc(nobody(), 'rooms', ROOM)));
  await assertFails(getDoc(doc(nobody(), 'joinCodes', CODE)));
});

test('member joins with the right room code only', async () => {
  await createRoom(google('owner'), 'owner');
  await assertFails(joinAsMember(google('nat'), 'nat', 'ZZZZZZ'));
  await assertSucceeds(joinAsMember(google('nat'), 'nat'));
  await assertSucceeds(getDoc(doc(google('nat'), 'rooms', ROOM)));
});

test('a participant cannot make themselves owner', async () => {
  await createRoom(google('owner'), 'owner');
  await assertFails(setDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'nat'), {
    name: 'Nat', color: 0, kind: 'member', role: 'owner', status: 'active', pid: 'nat', joinCode: CODE, joinedAt: serverTimestamp(),
  }));
});

test('a new member sees who is in the room and changes only their own colour', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await assertSucceeds(getDocs(collection(google('nat'), 'rooms', ROOM, 'members')));
  await assertSucceeds(updateDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'nat'), { color: 4 }));
  await assertFails(updateDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'nat'), { color: 12 }));
  await assertFails(updateDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'owner'), { color: 4 }));
  await assertFails(getDocs(collection(google('stranger'), 'rooms', ROOM, 'members')));
});

// ------------------------------------------------------------------ guests

test('guest claims an invite and gets in; a new device revokes the old one', async () => {
  await createRoom(google('owner'), 'owner');
  await createInvite(google('owner'), 'owner');

  await assertSucceeds(claimInvite(guest('phone'), 'phone'));
  await assertSucceeds(getDoc(doc(guest('phone'), 'rooms', ROOM)));

  await assertSucceeds(claimInvite(guest('laptop'), 'laptop'));
  await assertSucceeds(getDoc(doc(guest('laptop'), 'rooms', ROOM)));
  await assertFails(getDoc(doc(guest('phone'), 'rooms', ROOM)));
});

test('guest cannot pick another name than the invite', async () => {
  await createRoom(google('owner'), 'owner');
  await createInvite(google('owner'), 'owner');
  const db = guest('g1');
  const b = writeBatch(db);
  b.update(doc(db, 'rooms', ROOM, 'invites', GUEST_CODE), { claimedBy: 'g1' });
  b.set(doc(db, 'rooms', ROOM, 'members', 'g1'), {
    name: 'Someone else', color: 2, kind: 'guest', role: 'participant', status: 'active', pid: 'pid_mos_000000000000000', inviteCode: GUEST_CODE, joinedAt: serverTimestamp(),
  });
  await assertFails(b.commit());
});

test('only hosts create invites; participants cannot list them', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await assertFails(createInvite(google('nat'), 'nat', 'AAAAAAAA'));
  await assertSucceeds(createInvite(google('owner'), 'owner'));
});

// ------------------------------------------------------------------ moderation

test('blocked member loses access and cannot rejoin', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await assertSucceeds(updateDoc(doc(google('owner'), 'rooms', ROOM, 'members', 'nat'), { status: 'blocked' }));
  await assertFails(getDoc(doc(google('nat'), 'rooms', ROOM)));
  await assertFails(joinAsMember(google('nat'), 'nat'));
  await assertFails(updateDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'nat'), { status: 'active' }));
});

test('nobody can change the owner; only the owner promotes co-hosts', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await joinAsMember(google('beer'), 'beer');
  await assertFails(updateDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'beer'), { role: 'cohost' }));
  await assertSucceeds(updateDoc(doc(google('owner'), 'rooms', ROOM, 'members', 'nat'), { role: 'cohost' }));
  await assertFails(updateDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'owner'), { status: 'blocked' }));
});

// ------------------------------------------------------------------ meetups

test('only hosts create meetups', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await assertFails(createMeetup(google('nat')));
  await assertSucceeds(createMeetup(google('owner')));
});

test('availability: own pid only, real dates only', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await createMeetup(google('owner'));
  const db = google('nat');
  const ok = { dates: '2026-11-14,2026-11-21', voteDates: '', votePlaces: [], hidden: false, updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db, 'rooms', ROOM, 'meetups', 'm1', 'avail', 'nat'), ok));
  await assertFails(setDoc(doc(db, 'rooms', ROOM, 'meetups', 'm1', 'avail', 'owner'), ok));
  await assertFails(setDoc(doc(db, 'rooms', ROOM, 'meetups', 'm1', 'avail', 'nat'), { ...ok, dates: 'not a date' }));
  await assertFails(setDoc(doc(db, 'rooms', ROOM, 'meetups', 'm1', 'avail', 'nat'), { ...ok, hidden: true }));
});

test('draws: host only, append-only, max 3 per kind', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await createMeetup(google('owner'));

  const draw = (db, n, id, pid) => {
    const b = writeBatch(db);
    b.update(doc(db, 'rooms', ROOM, 'meetups', 'm1'), { 'drawCount.date': n });
    b.set(doc(db, 'rooms', ROOM, 'meetups', 'm1', 'draws', id), {
      kind: 'date', candidates: ['2026-11-14', '2026-11-21'], result: '2026-11-21', n, pid, at: serverTimestamp(),
    });
    return b.commit();
  };

  await assertFails(draw(google('nat'), 1, 'd0', 'nat'));
  const host = google('owner');
  await assertSucceeds(draw(host, 1, 'd1', 'owner'));
  await assertSucceeds(draw(host, 2, 'd2', 'owner'));
  await assertSucceeds(draw(host, 3, 'd3', 'owner'));
  await assertFails(draw(host, 4, 'd4', 'owner'));
  await assertFails(updateDoc(doc(host, 'rooms', ROOM, 'meetups', 'm1', 'draws', 'd1'), { result: '2026-11-14' }));
  await assertFails(deleteDoc(doc(host, 'rooms', ROOM, 'meetups', 'm1', 'draws', 'd1')));
});

test('a draw result must be one of the candidates', async () => {
  await createRoom(google('owner'), 'owner');
  await createMeetup(google('owner'));
  const db = google('owner');
  const b = writeBatch(db);
  b.update(doc(db, 'rooms', ROOM, 'meetups', 'm1'), { 'drawCount.date': 1 });
  b.set(doc(db, 'rooms', ROOM, 'meetups', 'm1', 'draws', 'd1'), {
    kind: 'date', candidates: ['2026-11-14', '2026-11-21'], result: '2026-12-31', n: 1, pid: 'owner', at: serverTimestamp(),
  });
  await assertFails(b.commit());
});

test('deleting a room closes its meetups to former members', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await createMeetup(google('owner'));
  await assertSucceeds(getDoc(doc(google('nat'), 'rooms', ROOM, 'meetups', 'm1')));
  await assertSucceeds(deleteDoc(doc(google('owner'), 'rooms', ROOM)));
  await assertFails(getDoc(doc(google('nat'), 'rooms', ROOM, 'meetups', 'm1')));
});

// ------------------------------------------------------------------ meetup-only guests

test('members list meetups; a meetup-only guest sees and edits just that meetup', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await createMeetup(google('owner'), 'm1');
  await createMeetup(google('owner'), 'm2');
  await assertSucceeds(getDocs(query(collection(google('nat'), 'rooms', ROOM, 'meetups'), orderBy('createdAt', 'desc'))));

  await createInvite(google('owner'), 'owner');
  await claimInvite(guest('mos'), 'mos');
  await assertSucceeds(updateDoc(doc(google('owner'), 'rooms', ROOM, 'members', 'mos'), { meetId: 'm1' }));
  const db = guest('mos');
  const entry = { dates: '2026-11-14', voteDates: '', votePlaces: [], hidden: false, updatedAt: serverTimestamp() };
  await assertSucceeds(getDoc(doc(db, 'rooms', ROOM, 'meetups', 'm1')));
  await assertSucceeds(setDoc(doc(db, 'rooms', ROOM, 'meetups', 'm1', 'avail', 'pid_mos_000000000000000'), entry));
  await assertFails(getDoc(doc(db, 'rooms', ROOM, 'meetups', 'm2')));
  await assertFails(setDoc(doc(db, 'rooms', ROOM, 'meetups', 'm2', 'avail', 'pid_mos_000000000000000'), entry));
  await assertFails(getDocs(collection(db, 'rooms', ROOM, 'meetups')));
  await assertSucceeds(getDoc(doc(db, 'rooms', ROOM)));
});

test('only hosts set meetId, and a meetup-only guest stays a participant', async () => {
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await assertFails(updateDoc(doc(google('nat'), 'rooms', ROOM, 'members', 'nat'), { meetId: 'm1' }));
  await assertFails(updateDoc(doc(google('owner'), 'rooms', ROOM, 'members', 'nat'), { meetId: 'm1', role: 'cohost' }));
  await assertSucceeds(updateDoc(doc(google('owner'), 'rooms', ROOM, 'members', 'nat'), { meetId: 'm1' }));
  await assertSucceeds(updateDoc(doc(google('owner'), 'rooms', ROOM, 'members', 'nat'), { meetId: null }));
});

test('an invite scoped to a meetup gives a member doc with the same scope', async () => {
  await createRoom(google('owner'), 'owner');
  await createInvite(google('owner'), 'owner');
  await assertSucceeds(updateDoc(doc(google('owner'), 'rooms', ROOM, 'invites', GUEST_CODE), { meetId: 'm1' }));
  await assertFails(claimInvite(guest('mos'), 'mos')); // tries to join without the scope
  const b = writeBatch(guest('mos'));
  b.update(doc(guest('mos'), 'rooms', ROOM, 'invites', GUEST_CODE), { claimedBy: 'mos' });
  b.set(doc(guest('mos'), 'rooms', ROOM, 'members', 'mos'), {
    name: 'มอส', color: 2, kind: 'guest', role: 'participant', status: 'active', pid: 'pid_mos_000000000000000', inviteCode: GUEST_CODE, joinedAt: serverTimestamp(), meetId: 'm1',
  });
  await assertSucceeds(b.commit());
});

// ------------------------------------------------------------------ v1 import (admin)

test('site admin imports v1 entries and places; nobody else can', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'admins', 'owner'), { role: 'owner' }));
  await createRoom(google('owner'), 'owner');
  await joinAsMember(google('nat'), 'nat');
  await createMeetup(google('owner'), 'v1');
  const imported = { dates: '2026-11-28', voteDates: '', votePlaces: ['v1_abc'], hidden: false, updatedAt: serverTimestamp(), name: 'ทราย', color: 3 };
  const at = (db, pid) => doc(db, 'rooms', ROOM, 'meetups', 'v1', 'avail', pid);

  await assertFails(setDoc(at(google('nat'), 'pid_sai'), imported));
  await assertSucceeds(setDoc(at(google('owner'), 'pid_sai'), imported));
  await assertSucceeds(setDoc(at(google('owner'), 'pid_sai'), { ...imported, dates: '2026-11-21,2026-11-28' }));

  // Once the person saved their own entry in v2, the import leaves it alone.
  await assertSucceeds(setDoc(at(google('nat'), 'nat'), { dates: '2026-11-14', voteDates: '', votePlaces: [], hidden: false, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(at(google('owner'), 'nat'), { ...imported, name: 'Nat' }));

  const place = { title: 'SUNNY MAN', mapsUrl: '', gPlaceId: '', address: '', note: '', pid: 'pid_nan', createdAt: Timestamp.fromMillis(1762400000000) };
  await assertFails(setDoc(doc(google('nat'), 'rooms', ROOM, 'meetups', 'v1', 'places', 'v1_abc'), place));
  await assertFails(setDoc(doc(google('owner'), 'rooms', ROOM, 'meetups', 'v1', 'places', 'abc'), place));
  await assertSucceeds(setDoc(doc(google('owner'), 'rooms', ROOM, 'meetups', 'v1', 'places', 'v1_abc'), place));
  await assertSucceeds(deleteDoc(doc(google('owner'), 'rooms', ROOM, 'meetups', 'v1', 'places', 'v1_abc')));
});

// ------------------------------------------------------------------ everything else

test('admins collection and unknown paths are closed', async () => {
  await assertFails(setDoc(doc(google('owner'), 'admins', 'owner'), {}));
  await assertFails(setDoc(doc(google('owner'), 'anything', 'x'), { a: 1 }));
});
