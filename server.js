'use strict';
// NHL Analytics - local server (zero dependencies, needs Node 18+).
// Proxies + caches the NHL's public JSON APIs and serves the static frontend in /public.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1'; // local only
const WEB = process.env.NHL_WEB_BASE || 'https://api-web.nhle.com/v1';
const STATS = process.env.NHL_STATS_BASE || 'https://api.nhle.com/stats/rest/en';
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIN = 60 * 1000;
const TTL = { current: 5 * MIN, player: 10 * MIN, seasons: 6 * 60 * MIN, past: 24 * 60 * MIN };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------- season helpers ----------
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
const ttlFor = (season) => (season === currentSeasonId() ? TTL.current : TTL.past);

// ---------- cached fetch (with in-flight dedupe and stale-on-error) ----------
const cache = new Map();    // url -> { t, data }
const inflight = new Map(); // url -> Promise

async function getJson(url, ttl) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.data;
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'nhl-analytics-local/0.1', Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) throw new HttpError(404, 'Not found upstream');
      if (!res.ok) throw new HttpError(502, `NHL API returned ${res.status}`);
      const data = await res.json();
      cache.set(url, { t: Date.now(), data });
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

const dflt = (o) => (o && typeof o === 'object' ? o.default : o);

// ---------- data loaders ----------
async function getSeasons() {
  const d = await getJson(`${WEB}/standings-season`, TTL.seasons);
  return (d.seasons || []).map((s) => ({
    id: String(s.id), standingsStart: s.standingsStart, standingsEnd: s.standingsEnd,
  }));
}

async function getStandings(season) {
  let segment = 'now';
  if (season !== currentSeasonId()) {
    const s = (await getSeasons()).find((x) => x.id === season);
    if (!s) throw new HttpError(404, `Unknown season ${season}`);
    const end = String(s.standingsEnd || '').slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    segment = end && end < today ? end : 'now';
  }
  const d = await getJson(`${WEB}/standings/${segment}`, ttlFor(season));
  return (d.standings || []).map((t) => ({
    abbrev: dflt(t.teamAbbrev),
    name: `${dflt(t.placeName) || ''} ${dflt(t.teamCommonName) || ''}`.trim() || dflt(t.teamName),
    logo: t.teamLogo,
    conference: t.conferenceName,
    division: t.divisionName,
    gp: t.gamesPlayed,
    wins: t.wins,
    losses: t.losses,
    otLosses: t.otLosses,
    points: t.points,
    pointPct: t.pointPctg,
    regWins: t.regulationWins,
    regOtWins: t.regulationPlusOtWins,
    gf: t.goalFor,
    ga: t.goalAgainst,
    goalDiff: t.goalDifferential,
    home: { w: t.homeWins, l: t.homeLosses, otl: t.homeOtLosses },
    road: { w: t.roadWins, l: t.roadLosses, otl: t.roadOtLosses },
    l10: { w: t.l10Wins, l: t.l10Losses, otl: t.l10OtLosses },
    streak: t.streakCode ? `${t.streakCode}${t.streakCount}` : null,
    rank: { league: t.leagueSequence, conference: t.conferenceSequence, division: t.divisionSequence },
  }));
}

// Full skater list for a season, cached; filtering/sorting happens per request.
async function getSkaters(season, gameType) {
  const exp = encodeURIComponent(`seasonId=${season} and gameTypeId=${gameType}`);
  const url = `${STATS}/skater/summary?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=${exp}`;
  const d = await getJson(url, ttlFor(season));
  return (d.data || []).map((p) => ({
    id: p.playerId,
    name: p.skaterFullName,
    teams: p.teamAbbrevs ? String(p.teamAbbrevs).split(',') : [],
    pos: p.positionCode,
    gp: p.gamesPlayed,
    goals: p.goals,
    assists: p.assists,
    points: p.points,
    shots: p.shots,
    shootingPct: p.shootingPct,
    plusMinus: p.plusMinus,
    pim: p.penaltyMinutes,
    toiPerGame: p.timeOnIcePerGame,
    pointsPerGame: p.pointsPerGame,
    ppPoints: p.ppPoints,
    gwg: p.gameWinningGoals,
  }));
}

const SORTABLE = new Set(['goals', 'assists', 'points', 'shots', 'gp', 'shootingPct',
  'plusMinus', 'pim', 'toiPerGame', 'pointsPerGame', 'ppPoints', 'gwg']);

async function getPlayer(id) {
  const d = await getJson(`${WEB}/player/${id}/landing`, TTL.player);
  const nhlSeasons = (d.seasonTotals || []).filter((s) => s.leagueAbbrev === 'NHL' && s.gameTypeId === 2);
  return {
    id: d.playerId,
    name: `${dflt(d.firstName) || ''} ${dflt(d.lastName) || ''}`.trim(),
    team: d.currentTeamAbbrev,
    pos: d.position,
    number: d.sweaterNumber,
    headshot: d.headshot,
    featured: d.featuredStats || null,
    career: d.careerTotals || null,
    seasons: nhlSeasons.map((s) => ({
      season: String(s.season), team: dflt(s.teamName), gp: s.gamesPlayed,
      goals: s.goals, assists: s.assists, points: s.points, shots: s.shots,
      plusMinus: s.plusMinus, pim: s.pim,
    })),
    last5: d.last5Games || [],
  };
}

async function getGameLog(id, season, gameType) {
  const d = await getJson(`${WEB}/player/${id}/game-log/${season}/${gameType}`, ttlFor(season));
  return (d.gameLog || []).map((g) => ({
    date: g.gameDate, opp: g.opponentAbbrev, homeRoad: g.homeRoadFlag,
    goals: g.goals, assists: g.assists, points: g.points, shots: g.shots,
    plusMinus: g.plusMinus, pim: g.pim, toi: g.toi,
  }));
}

// ---------- routing ----------
async function handleApi(url) {
  const p = url.pathname;
  const q = url.searchParams;
  let m;

  if (p === '/api/health') return { ok: true, currentSeason: currentSeasonId(), cached: cache.size };

  if (p === '/api/seasons') return { current: currentSeasonId(), seasons: await getSeasons() };

  if (p === '/api/standings') {
    const season = parseSeason(q.get('season'));
    return { season, teams: await getStandings(season) };
  }

  if (p === '/api/skaters') {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    let rows = await getSkaters(season, gameType);

    const team = (q.get('team') || '').toUpperCase();
    const pos = (q.get('pos') || '').toUpperCase();
    const name = (q.get('q') || '').toLowerCase();
    if (team) rows = rows.filter((r) => r.teams.includes(team));
    if (pos) rows = rows.filter((r) => r.pos === pos);
    if (name) rows = rows.filter((r) => (r.name || '').toLowerCase().includes(name));

    const sort = q.get('sort') || 'points';
    if (!SORTABLE.has(sort)) throw new HttpError(400, `sort must be one of: ${[...SORTABLE].join(', ')}`);
    const dir = q.get('dir') === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => dir * ((a[sort] ?? 0) - (b[sort] ?? 0)) || (b.points ?? 0) - (a.points ?? 0));

    const total = rows.length;
    const limit = Math.min(Math.max(parseInt(q.get('limit'), 10) || 50, 1), 2000);
    return { season, gameType, total, players: rows.slice(0, limit) };
  }

  if ((m = p.match(/^\/api\/player\/(\d+)$/))) return getPlayer(m[1]);

  if ((m = p.match(/^\/api\/player\/(\d+)\/gamelog$/))) {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    return { season, gameType, games: await getGameLog(m[1], season, gameType) };
  }

  throw new HttpError(404, 'Unknown API route');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, 'Forbidden');
  let stat;
  try { stat = fs.statSync(file); } catch { throw new HttpError(404, 'Not found'); }
  if (!stat.isFile()) throw new HttpError(404, 'Not found');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'GET only');
    const url = new URL(req.url, `http://${HOST}`);
    if (url.pathname.startsWith('/api/')) return sendJson(res, 200, await handleApi(url));
    serveStatic(url.pathname, res);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: err.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`NHL Analytics running at http://localhost:${PORT}  (season ${currentSeasonId()})`);
});
