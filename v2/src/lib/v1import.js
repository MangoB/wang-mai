// Turn the v1 first meetup (people/places) into v2 meetup documents. Pure: no Firebase here.
// See docs/decisions/0001-first-meetup-into-v2.md.

/** Same normalisation v1 uses for names: trim, collapse spaces, lower case. */
export const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const dateList = (arr) => [...new Set((arr || []).filter(isDate))].sort().join(',');

/**
 * @param {object} input
 * @param {Array<{id, name, dates, voteDates, votePlaces}>} input.people   v1 people docs
 * @param {Array<{id, title, url, note, byKey, createdAt}>} input.places   v1 places docs
 * @param {Array<{name, pid, color}>} input.roster   everyone in the v2 room (members and invites)
 * @returns {{ avail: Array<{pid, name, color, dates, voteDates, votePlaces}>,
 *             places: Array<{id, title, mapsUrl, note, pid, createdAtMs}>, unmatched: string[] }}
 */
export function planImport({ people, places, roster }) {
  const byName = new Map(roster.map((r) => [normName(r.name), r]));
  const pidOfKey = new Map();
  const unmatched = [];

  for (const p of people) {
    const r = byName.get(normName(p.name));
    if (r) pidOfKey.set(p.id, r);
  }

  const outPlaces = places.map((pl) => ({
    id: 'v1_' + pl.id,
    title: String(pl.title || '').slice(0, 80) || 'สถานที่',
    mapsUrl: /^https:\/\//.test(pl.url || '') ? pl.url.slice(0, 500) : '',
    note: String(pl.note || '').slice(0, 300),
    pid: (pidOfKey.get(pl.byKey) || {}).pid || 'v1_' + (pl.byKey || 'unknown').slice(0, 37),
    createdAtMs: Number(pl.createdAt) || 0,
  }));
  const placeIds = new Set(outPlaces.map((p) => p.id));

  const avail = [];
  for (const p of people) {
    const active = (p.dates || []).length || (p.voteDates || []).length || (p.votePlaces || []).length
      || places.some((pl) => pl.byKey === p.id);
    if (!active) continue;
    const r = pidOfKey.get(p.id);
    if (!r) { unmatched.push(p.name); continue; }
    avail.push({
      pid: r.pid,
      name: String(r.name).slice(0, 30),
      color: r.color,
      dates: dateList(p.dates),
      voteDates: dateList(p.voteDates),
      votePlaces: (p.votePlaces || []).map((id) => 'v1_' + id).filter((id) => placeIds.has(id)).slice(0, 100),
    });
  }
  return { avail, places: outPlaces, unmatched };
}
