'use strict';
// Two caches, both in memory and on disk (SQLite, built into Node 22.13+):
//  - http:    raw NHL responses by URL, with a time-to-live
//  - derived: results we compute (e.g. shots from a play-by-play) by key, so the
//             big raw files never need storing. Final games are cached for good.
// If SQLite is unavailable the app runs on the memory cache alone.

const fs = require('node:fs');
const path = require('node:path');
const { HttpError } = require('./util');

const MIN = 60 * 1000;
const TTL = {
  current: 5 * MIN,
  player: 10 * MIN,
  seasons: 6 * 60 * MIN,
  past: 24 * 60 * MIN,
  live: 1 * MIN,
  forever: Infinity,
};

const DATA_DIR = path.join(__dirname, '..', 'data');

let db = null;
try {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(path.join(DATA_DIR, 'cache.db'));
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS http_cache (url TEXT PRIMARY KEY, t INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS derived (key TEXT PRIMARY KEY, t INTEGER NOT NULL, data TEXT NOT NULL);`);
} catch (err) {
  console.warn(`Disk cache disabled (${err.message}); using memory only.`);
  db = null;
}

function table(name) {
  if (!db) return { read: () => null, write: () => {} };
  const get = db.prepare(`SELECT t, data FROM ${name} WHERE ${name === 'derived' ? 'key' : 'url'} = ?`);
  const put = db.prepare(`INSERT OR REPLACE INTO ${name} VALUES (?, ?, ?)`);
  return {
    read(k) {
      try {
        const row = get.get(k);
        return row ? { t: Number(row.t), data: JSON.parse(row.data) } : null;
      } catch { return null; }
    },
    write(k, t, data) {
      try { put.run(k, t, JSON.stringify(data)); } catch { /* best effort */ }
    },
  };
}
const httpDisk = table('http_cache');
const derivedDisk = table('derived');

// Memory side. Raw responses can be large, so the memory map is capped (oldest out).
const MEM_LIMIT = 400;
const mem = new Map();
function memSet(k, v) {
  mem.delete(k);
  mem.set(k, v);
  if (mem.size > MEM_LIMIT) mem.delete(mem.keys().next().value);
}

const inflight = new Map();

/**
 * Fetch JSON with caching, request sharing and stale-on-error.
 * opts.persist=false keeps a response out of the disk cache (used for play-by-play,
 * where only the derived shots are worth storing).
 */
async function getJson(url, ttl, opts = {}) {
  const persist = opts.persist !== false;
  let hit = mem.get(`h:${url}`);
  if (!hit && persist) {
    hit = httpDisk.read(url);
    if (hit) memSet(`h:${url}`, hit);
  }
  if (hit && Date.now() - hit.t < ttl) return hit.data;
  if (inflight.has(url)) return inflight.get(url);

  const p = (async () => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'nhl-analytics-local/0.2', Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 404) throw new HttpError(404, 'Not found upstream');
      if (!res.ok) throw new HttpError(502, `NHL API returned ${res.status}`);
      const data = await res.json();
      const t = Date.now();
      memSet(`h:${url}`, { t, data });
      if (persist) httpDisk.write(url, t, data);
      return data;
    } catch (err) {
      if (hit) return hit.data; // serve stale rather than fail
      if (err instanceof HttpError) throw err;
      throw new HttpError(502, `Could not reach NHL API: ${err.message}`);
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

/**
 * Cache a computed value. compute() returns { data, ttl }; ttl decides how long it is
 * reused (Infinity for finished games). Concurrent callers share one computation.
 */
async function derived(key, compute) {
  let hit = mem.get(`d:${key}`);
  if (!hit) {
    hit = derivedDisk.read(key);
    if (hit) memSet(`d:${key}`, hit);
  }
  if (hit && (hit.ttl === undefined || hit.ttl === null || Date.now() - hit.t < hit.ttl)) return hit.data;
  const k = `d:${key}`;
  if (inflight.has(k)) return inflight.get(k);
  const p = (async () => {
    try {
      const { data, ttl } = await compute();
      const t = Date.now();
      const entry = { t, ttl: ttl === Infinity ? null : ttl, data };
      memSet(k, entry);
      if (ttl === Infinity || ttl >= TTL.past) derivedDisk.write(key, t, entry);
      return data;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}

// derivedDisk stores {ttl, data} inside data; unwrap on read.
const _read = derivedDisk.read;
derivedDisk.read = (k) => {
  const row = _read(k);
  return row ? { t: row.t, ttl: row.data.ttl, data: row.data.data } : null;
};

function stats() {
  return { memory: mem.size, disk: Boolean(db) };
}

module.exports = { TTL, getJson, derived, stats };
