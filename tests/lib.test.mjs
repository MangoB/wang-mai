// Pure helpers in src/lib and v2/src/lib. Run: node --test tests/lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planImport, normName } from '../v2/src/lib/v1import.js';
import { pickColor, freeColor } from '../v2/src/lib/palette.js';

test('pickColor keeps a free colour and replaces a taken one', () => {
  assert.equal(pickColor(3, [1, 2]), 3);
  assert.equal(pickColor(1, [0, 1, 2]), 3);
  assert.equal(freeColor([...Array(12).keys()]), 0);
});

test('planImport maps v1 names to v2 people and keeps votes on imported places', () => {
  const roster = [
    { name: 'หยก', pid: 'uid_yok', color: 7 },
    { name: 'แนน ', pid: 'g_nan', color: 4 },
  ];
  const people = [
    { id: 'pyok', name: 'หยก', dates: ['2026-11-28', '2026-11-22', '2026-11-22'], voteDates: ['2026-11-22'], votePlaces: ['A', 'gone'] },
    { id: 'pnan', name: 'แนน', dates: [], voteDates: [], votePlaces: [] },
    { id: 'pbob', name: 'Bob', dates: ['2026-11-01'], voteDates: [], votePlaces: [] },
    { id: 'pidle', name: 'idle', dates: [], voteDates: [], votePlaces: [] },
  ];
  const places = [{ id: 'A', title: 'SUNNY MAN', url: 'https://maps.app.goo.gl/x', note: 'n', byKey: 'pnan', createdAt: 1762400000000 },
    { id: 'B', title: 'Old', url: 'http://insecure', note: '', byKey: 'pbob', createdAt: 1 }];
  const out = planImport({ people, places, roster });

  assert.deepEqual(out.unmatched, ['Bob']);
  const yok = out.avail.find((a) => a.pid === 'uid_yok');
  assert.equal(yok.dates, '2026-11-22,2026-11-28');
  assert.deepEqual(yok.votePlaces, ['v1_A']);
  assert.ok(out.avail.some((a) => a.pid === 'g_nan'), 'a person who only added a place is imported');
  assert.equal(out.places.find((p) => p.id === 'v1_A').pid, 'g_nan');
  assert.equal(out.places.find((p) => p.id === 'v1_B').mapsUrl, '');
  assert.equal(normName('  แนน  '), 'แนน');
});
