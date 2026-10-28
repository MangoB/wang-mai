/** Pull a place name and coordinates out of a Google Maps link, when the link carries them.
 *  Short links (maps.app.goo.gl/…) carry neither; those still open fine, just with no details. */
export function parseMap(url) {
  try {
    const u = new URL(url);
    let name = '';
    let lat = null;
    let lng = null;
    const m = u.pathname.match(/\/place\/([^/]+)/);
    if (m) name = decodeURIComponent(m[1].replace(/\+/g, ' '));
    const c = (u.pathname + u.search).match(/@?(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
    if (c) { lat = Number(c[1]); lng = Number(c[2]); }
    if (!name) {
      const q = u.searchParams.get('q') || u.searchParams.get('query');
      if (q && !/^-?\d/.test(q)) name = q;
    }
    return { name, lat, lng };
  } catch {
    return { name: '', lat: null, lng: null };
  }
}

/** Keyless Google Maps embed. Prefers exact coordinates, falls back to searching the place title. */
export function embedUrl(place) {
  const { lat, lng, name } = parseMap(place.url || '');
  const q = lat != null ? lat + ',' + lng : (name || place.title);
  if (!q) return '';
  return 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=16&output=embed';
}

/** Accept only http(s) links; add https:// when the scheme is missing. Returns '' for an empty input, null for an invalid one. */
export function cleanUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null;
  } catch {
    return null;
  }
}
