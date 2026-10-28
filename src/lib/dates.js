export const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const WD_LONG = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const MSHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const pad = (n) => String(n).padStart(2, '0');

/** Local-time date → "YYYY-MM-DD". */
export const keyOfDate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

/** "YYYY-MM-DD" → local Date at midnight. */
export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Every date from `from` to `to` (inclusive, never before today) whose weekday is in `days` (0 = Sunday). */
export function datesMatching(fromKey, toKey, days, today = startOfToday(), cap = 800) {
  if (!fromKey || !toKey || !days.length) return [];
  let a = parseKey(fromKey);
  const b = parseKey(toKey);
  if (a < today) a = new Date(today);
  if (b < a) return [];
  const out = [];
  for (const d = new Date(a); d <= b && out.length < cap; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) out.push(keyOfDate(d));
  }
  return out;
}

const be = (y) => y + 543; // พ.ศ.

export function fmtShort(k) {
  const d = parseKey(k);
  return d.getDate() + ' ' + MSHORT[d.getMonth()];
}

export function fmtWeekday(k, today = startOfToday()) {
  const d = parseKey(k);
  return 'วัน' + WD_LONG[d.getDay()] + (d.getFullYear() !== today.getFullYear() ? ' ' + be(d.getFullYear()) : '');
}

export function fmtLong(k) {
  const d = parseKey(k);
  return 'วัน' + WD_LONG[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + be(d.getFullYear());
}

export const monthTitle = (y, m) => MONTHS[m] + ' ' + be(y);
