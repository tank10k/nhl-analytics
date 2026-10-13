'use strict';
// Image proxy for NHL headshots and logos. Serving them from our own origin lets the
// browser draw them into a canvas, which is what "Save card as image" needs (images
// from another site would block the export). Only NHL image hosts are allowed.

const { HttpError } = require('./util');

const ALLOWED = new Set(['assets.nhle.com', 'cms.nhl.bamgrid.com']);
// When testing against a local stand-in (NHL_WEB_BASE), allow its host too.
for (const base of [process.env.NHL_WEB_BASE, process.env.NHL_STATS_BASE]) {
  try { if (base) ALLOWED.add(new URL(base).host); } catch { /* ignore */ }
}

const TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif']);
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_ITEMS = 300;
const mem = new Map(); // src -> { type, body }

async function getImage(src) {
  let url;
  try { url = new URL(src); } catch { throw new HttpError(400, 'src must be a full image URL'); }
  if (!/^https?:$/.test(url.protocol) || !ALLOWED.has(url.host)) throw new HttpError(403, 'Only NHL image hosts are allowed');

  const hit = mem.get(url.href);
  if (hit) return hit;

  let res;
  try {
    res = await fetch(url.href, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'nhl-analytics-local/0.3' } });
  } catch (err) {
    throw new HttpError(502, `Could not load image: ${err.message}`);
  }
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, `Image returned ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!TYPES.has(type)) throw new HttpError(502, 'Not an image');
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_BYTES) throw new HttpError(502, 'Image too large');

  const item = { type, body };
  mem.set(url.href, item);
  if (mem.size > MAX_ITEMS) mem.delete(mem.keys().next().value);
  return item;
}

module.exports = { getImage };
