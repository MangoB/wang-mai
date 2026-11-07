// Pure helpers in src/lib. Run: node --test tests/lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickColor, freeColor } from '../src/lib/palette.js';

test('pickColor keeps a free colour and replaces a taken one', () => {
  assert.equal(pickColor(3, [1, 2]), 3);
  assert.equal(pickColor(1, [0, 1, 2]), 3);
  assert.equal(freeColor([...Array(12).keys()]), 0);
});
