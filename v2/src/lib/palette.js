// Person colours. Stored in the database as an index 0–11 (docs/design-system.md).
export const COLORS = [
  { name: 'มะเขือเทศ', hex: '#E5484D', ink: false },
  { name: 'ส้ม', hex: '#F76B15', ink: false },
  { name: 'มะม่วง', hex: '#F5B100', ink: true },
  { name: 'มะนาว', hex: '#7DB800', ink: true },
  { name: 'ใบเตย', hex: '#30A46C', ink: false },
  { name: 'เขียวทะเล', hex: '#12A594', ink: false },
  { name: 'ฟ้า', hex: '#0091D5', ink: false },
  { name: 'คราม', hex: '#3E63DD', ink: false },
  { name: 'ม่วง', hex: '#8E4EC6', ink: false },
  { name: 'ชมพู', hex: '#D6409F', ink: false },
  { name: 'ชาไทย', hex: '#B0703F', ink: false },
  { name: 'หมึกจีน', hex: '#56607A', ink: false },
];

export const colorOf = (i) => COLORS[((i % 12) + 12) % 12];

/** First colour nobody in `used` has; wraps around when all 12 are taken. */
export function freeColor(used) {
  const taken = new Set(used);
  for (let i = 0; i < COLORS.length; i++) if (!taken.has(i)) return i;
  return used.length % COLORS.length;
}

/** Keep `preferred` unless someone in `used` already has it; then take the first free colour. */
export function pickColor(preferred, used) {
  return used.includes(preferred) ? freeColor(used) : preferred;
}

/** Inline style for a person chip. */
export function chipStyle(i) {
  const c = colorOf(i);
  return { background: c.hex, color: c.ink ? 'var(--ink-fixed)' : '#fff' };
}
