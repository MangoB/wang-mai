// Random codes for rooms and guests. Alphabet drops 0/O/1/I so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

function pick(chars, n) {
  const out = [];
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) out.push(chars[buf[i] % chars.length]);
  return out.join('');
}

export const newRoomCode = () => pick(ALPHABET, 6);
export const newGuestCode = () => pick(ALPHABET, 8);
export const newPid = () => 'g_' + pick(LOWER, 22);

/** Normalise what people type: upper-case, drop spaces and dashes. */
export const cleanCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "K7QX2M" → "K7Q-X2M", "HX4P9KTW" → "HX4P-9KTW" */
export function prettyCode(c) {
  if (!c) return '';
  return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : c.slice(0, 4) + '-' + c.slice(4);
}

export const isRoomCode = (c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c);
export const isGuestCode = (c) => /^[A-HJ-NP-Z2-9]{8}$/.test(c);
