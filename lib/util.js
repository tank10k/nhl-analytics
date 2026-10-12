'use strict';
// Shared helpers: errors, season ids, input parsing, small async utilities.

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function currentSeasonId(d = new Date()) {
  const y = d.getFullYear();
  const start = d.getMonth() + 1 >= 9 ? y : y - 1; // NHL season rolls over ~Sept
  return `${start}${start + 1}`;
}

function parseSeason(v) {
  const s = v || currentSeasonId();
  if (!/^\d{8}$/.test(s) || Number(s.slice(4)) !== Number(s.slice(0, 4)) + 1)
    throw new HttpError(400, 'season must look like 20252026');
  return s;
}

function parseGameType(v) {
  const g = v || '2';
  if (g !== '2' && g !== '3') throw new HttpError(400, 'gameType must be 2 (regular) or 3 (playoffs)');
  return g;
}

function parseTeam(v) {
  const t = String(v || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(t)) throw new HttpError(400, 'team must be a three-letter abbreviation such as TOR');
  return t;
}

// NHL fields are often { default: "..." } localized objects.
const dflt = (o) => (o && typeof o === 'object' ? o.default : o);

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** "12:34" -> 754 */
function mmssToSec(s) {
  if (typeof s !== 'string') return null;
  const [m, sec] = s.split(':').map(Number);
  return Number.isFinite(m) && Number.isFinite(sec) ? m * 60 + sec : null;
}

/** Run fn over items with at most `limit` running at once; keeps input order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

module.exports = { HttpError, currentSeasonId, parseSeason, parseGameType, parseTeam, dflt, num, mmssToSec, mapLimit };
