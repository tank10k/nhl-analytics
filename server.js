'use strict';
// NHL Analytics - local server (no npm dependencies, needs Node 22.13+).
// Proxies + caches the NHL's public JSON APIs, computes derived stats (percentiles,
// shot data, expected goals), and serves the React app (dist/) and the original app (public/).
//
//   lib/util.js     errors, season ids, input parsing
//   lib/cache.js    memory + SQLite disk cache
//   lib/loaders.js  standings, skaters, goalies, team stats, players, schedules, percentiles
//   lib/shots.js    play-by-play shots and the expected-goals model
//   lib/images.js   same-origin proxy for NHL headshots and logos (for card image export)

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { HttpError, currentSeasonId, parseSeason, parseGameType, parseTeam } = require('./lib/util');
const cache = require('./lib/cache');
const L = require('./lib/loaders');
const shots = require('./lib/shots');
const images = require('./lib/images');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1'; // local only
const DIST_DIR = path.join(__dirname, 'dist');     // new React app (npm run build)
const LEGACY_DIR = path.join(__dirname, 'public'); // original app, kept until fully replaced

// ---------- routing ----------

const SKATER_SORT = new Set(['goals', 'assists', 'points', 'shots', 'gp', 'shootingPct',
  'plusMinus', 'pim', 'toiPerGame', 'pointsPerGame', 'ppPoints', 'gwg', 'hits', 'blocks']);
const GOALIE_SORT = new Set(['gp', 'wins', 'savePct', 'gaa', 'shutouts', 'saves']);

function sortRows(rows, q, allowed, dflt, ascByDefault = []) {
  const sort = q.get('sort') || dflt;
  if (!allowed.has(sort)) throw new HttpError(400, `sort must be one of: ${[...allowed].join(', ')}`);
  const dirParam = q.get('dir');
  const dir = dirParam ? (dirParam === 'asc' ? 1 : -1) : ascByDefault.includes(sort) ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort], bv = b[sort];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last either way
    if (bv == null) return -1;
    return dir * (av - bv);
  });
}

const limitOf = (q, dflt = 50) => Math.min(Math.max(parseInt(q.get('limit'), 10) || dflt, 1), 2000);

// One line per route; also served at /api so you can click through them in a browser.
const ROUTES = [
  ['/api/health', 'Server status and cache info'],
  ['/api/seasons', 'Seasons with start/end dates'],
  ['/api/standings?season=', 'Standings for a season'],
  ['/api/teams/stats?season=&gameType=', 'Team shots, shot share, PDO, PP%, PK%, faceoff%'],
  ['/api/team/:abbrev/schedule?season=', 'A team\'s games with results and running points'],
  ['/api/team/:abbrev/shots?season=&gameType=', 'Every shot for/against a team, with xG (slow on first load)'],
  ['/api/league/race?season=', 'Cumulative points by game number for every team'],
  ['/api/skaters?season=&gameType=&team=&pos=&q=&sort=&dir=&limit=', 'Skater stats (incl. hits, blocks)'],
  ['/api/goalies?season=&gameType=&team=&minGp=&sort=&dir=&limit=', 'Goalie stats'],
  ['/api/percentiles?season=&gameType=&pos=F|D', 'Percentile ranks for every skater by position group'],
  ['/api/player/:id', 'Player profile, bio, draft, awards, season-by-season'],
  ['/api/player/:id/gamelog?season=&gameType=', 'Game-by-game log'],
  ['/api/player/:id/percentiles?season=&gameType=', 'One skater\'s percentile ranks'],
  ['/api/player/:id/shots?season=&gameType=', 'Every shot attempt by a skater, with xG'],
  ['/api/game/:id/shots', 'Every shot in one game, with xG'],
  ['/api/image?src=', 'NHL headshot or logo served from this server (used by player cards)'],
];

async function handleApi(url) {
  const p = url.pathname.replace(/\/+$/, '') || '/api';
  const q = url.searchParams;
  let m;

  if (p === '/api') return { routes: ROUTES.map(([route, about]) => ({ route, about })) };

  if (p === '/api/health') {
    return {
      ok: true, currentSeason: currentSeasonId(), cache: cache.stats(),
      built: fs.existsSync(path.join(DIST_DIR, 'index.html')), xgModel: shots.MODEL_VERSION,
    };
  }

  if (p === '/api/seasons') return { current: currentSeasonId(), seasons: await L.getSeasons() };

  if (p === '/api/standings') {
    const season = parseSeason(q.get('season'));
    return { season, teams: await L.getStandings(season) };
  }

  if (p === '/api/teams/stats') {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    return { season, gameType, teams: await L.getTeamStats(season, gameType) };
  }

  if ((m = p.match(/^\/api\/team\/([A-Za-z]{3})\/schedule$/))) {
    const team = parseTeam(m[1]);
    const season = parseSeason(q.get('season'));
    return { team, season, games: await L.getSchedule(team, season) };
  }

  if ((m = p.match(/^\/api\/team\/([A-Za-z]{3})\/shots$/))) {
    return shots.getTeamShots(parseTeam(m[1]), parseSeason(q.get('season')), parseGameType(q.get('gameType')));
  }

  if (p === '/api/league/race') return L.getRace(parseSeason(q.get('season')));

  if (p === '/api/skaters') {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    let rows = await L.getSkaters(season, gameType);
    const team = (q.get('team') || '').toUpperCase();
    const pos = (q.get('pos') || '').toUpperCase();
    const name = (q.get('q') || '').toLowerCase();
    if (team) rows = rows.filter((r) => r.teams.includes(team));
    if (pos === 'F') rows = rows.filter((r) => r.pos !== 'D');
    else if (pos) rows = rows.filter((r) => r.pos === pos);
    if (name) rows = rows.filter((r) => (r.name || '').toLowerCase().includes(name));
    rows = sortRows(rows, q, SKATER_SORT, 'points');
    return { season, gameType, total: rows.length, players: rows.slice(0, limitOf(q)) };
  }

  if (p === '/api/goalies') {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    let rows = await L.getGoalies(season, gameType);
    const team = (q.get('team') || '').toUpperCase();
    const minGp = parseInt(q.get('minGp'), 10) || 0;
    if (team) rows = rows.filter((r) => r.teams.includes(team));
    if (minGp) rows = rows.filter((r) => r.gp >= minGp);
    rows = sortRows(rows, q, GOALIE_SORT, 'wins', ['gaa']);
    return { season, gameType, total: rows.length, goalies: rows.slice(0, limitOf(q)) };
  }

  if (p === '/api/percentiles') {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    const pos = (q.get('pos') || '').toUpperCase();
    if (pos && pos !== 'F' && pos !== 'D') throw new HttpError(400, 'pos must be F (forwards) or D (defense)');
    const data = await L.getPercentiles(season, gameType);
    const players = Object.values(data.players).filter((x) => x.eligible && (!pos || x.group === pos));
    return { season, gameType, minGp: data.minGp, poolSize: data.poolSize, metrics: data.metrics, players };
  }

  if ((m = p.match(/^\/api\/player\/(\d+)$/))) return L.getPlayer(m[1]);

  if ((m = p.match(/^\/api\/player\/(\d+)\/gamelog$/))) {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    return { season, gameType, games: await L.getGameLog(m[1], season, gameType) };
  }

  if ((m = p.match(/^\/api\/player\/(\d+)\/percentiles$/))) {
    const season = parseSeason(q.get('season'));
    const gameType = parseGameType(q.get('gameType'));
    const data = await L.getPercentiles(season, gameType);
    const row = data.players[m[1]];
    if (!row) throw new HttpError(404, 'No skater stats for this player in that season (goalies are not ranked here)');
    return { season, gameType, minGp: data.minGp, poolSize: data.poolSize[row.group], metrics: data.metrics, ...row };
  }

  if ((m = p.match(/^\/api\/player\/(\d+)\/shots$/))) {
    return shots.getPlayerShots(m[1], parseSeason(q.get('season')), parseGameType(q.get('gameType')));
  }

  if ((m = p.match(/^\/api\/game\/(\d+)\/shots$/))) return shots.getGameShots(m[1]);

  throw new HttpError(404, 'Unknown API route (see /api for the list)');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
};

// Resolve a URL path inside a folder, refusing anything that escapes it.
function fileIn(dir, rel) {
  const file = path.resolve(dir, rel);
  if (file !== dir && !file.startsWith(dir + path.sep)) throw new HttpError(403, 'Forbidden');
  try { return fs.statSync(file).isFile() ? file : null; } catch { return null; }
}

function sendFile(res, file, immutable) {
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

const NOT_BUILT = `<!doctype html><meta charset="utf-8"><title>NHL Analytics</title>
<body style="font:16px system-ui;background:#0a1424;color:#eaf1fa;padding:40px;max-width:640px">
<h1>The new app hasn't been built yet</h1>
<p>While developing, run <code>npm run dev</code> and open <a style="color:#7cb8ff" href="http://localhost:5173">localhost:5173</a>.</p>
<p>To serve it from here, run <code>npm run build</code> once, then <code>npm start</code>.</p>
<p>The original app is still at <a style="color:#7cb8ff" href="/legacy">/legacy</a>.</p></body>`;

// Order: built React app (dist/) -> original pages (public/, reachable at /legacy and
// their old paths such as /players.html) -> React app's index.html for its client-side routes.
function serveStatic(pathname, res) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');

  if (rel === 'legacy' || rel === 'legacy/') return sendFile(res, fileIn(LEGACY_DIR, 'index.html'));

  if (rel) {
    const built = fileIn(DIST_DIR, rel);
    if (built) return sendFile(res, built, rel.startsWith('assets/'));
    const legacy = fileIn(LEGACY_DIR, rel);
    if (legacy && rel !== 'index.html') return sendFile(res, legacy);
    if (path.extname(rel)) throw new HttpError(404, 'Not found');
  }

  const app = fileIn(DIST_DIR, 'index.html');
  if (app) return sendFile(res, app);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(NOT_BUILT);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'GET only');
    const url = new URL(req.url, `http://${HOST}`);
    if (url.pathname === '/api/image') {
      const img = await images.getImage(url.searchParams.get('src') || '');
      res.writeHead(200, { 'Content-Type': img.type, 'Cache-Control': 'public, max-age=86400' });
      return res.end(img.body);
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return sendJson(res, 200, await handleApi(url));
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
