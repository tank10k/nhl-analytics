'use strict';
// Checks every API route against live NHL data and reports which fields came back.
// Usage: start the server (npm run dev or npm start), then in a second terminal:
//   npm run check
// Optional: CHECK_URL=http://localhost:4000 npm run check

const BASE = process.env.CHECK_URL || 'http://localhost:3000';
const rows = [];

async function get(path) {
  const t = Date.now();
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(180000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return { body, ms: Date.now() - t };
}

/** Share of rows where field is not null/undefined. */
function filled(list, field) {
  if (!list.length) return 'no rows';
  const n = list.filter((r) => {
    const v = field.split('.').reduce((o, k) => (o == null ? o : o[k]), r);
    return v !== null && v !== undefined;
  }).length;
  return `${Math.round((n / list.length) * 100)}%`;
}

async function check(name, path, inspect) {
  try {
    const { body, ms } = await get(path);
    const notes = inspect(body);
    rows.push({ route: name, status: 'OK', time: `${(ms / 1000).toFixed(1)}s`, notes });
    return body;
  } catch (err) {
    rows.push({ route: name, status: 'FAIL', time: '', notes: err.message });
    return null;
  }
}

(async () => {
  console.log(`Checking ${BASE} ... (the shot routes can take a minute on first run)\n`);

  const health = await check('health', '/api/health', (b) => `season ${b.currentSeason}, disk cache ${b.cache?.disk ? 'on' : 'off'}`);
  if (!health) {
    console.log('The server is not responding. Start it with npm run dev (or npm start) first.');
    process.exit(1);
  }
  const season = health.currentSeason;

  const standings = await check('standings', `/api/standings?season=${season}`,
    (b) => `${b.teams.length} teams, logo ${filled(b.teams, 'logo')}`);
  const team = standings?.teams?.[0]?.abbrev || 'TOR';

  await check('teams/stats', `/api/teams/stats?season=${season}`, (b) =>
    `${b.teams.length} teams, matched to abbrev ${filled(b.teams, 'abbrev')}, shot share ${filled(b.teams, 'shotShare')}, PP% ${filled(b.teams, 'powerPlayPct')}, PDO ${filled(b.teams, 'pdo')}`);

  const sched = await check(`team/${team}/schedule`, `/api/team/${team}/schedule?season=${season}`, (b) => {
    const done = b.games.filter((g) => g.result);
    return `${b.games.length} games, ${done.length} final, last running total ${done.at(-1)?.points ?? '–'} pts`;
  });

  await check('league/race', `/api/league/race?season=${season}`, (b) =>
    `${b.teams.length} teams, games per team ${Math.min(...b.teams.map((t) => t.games.length))}–${Math.max(...b.teams.map((t) => t.games.length))}`);

  const skaters = await check('skaters', `/api/skaters?season=${season}&limit=2000`, (b) =>
    `${b.total} skaters, hits ${filled(b.players, 'hits')}, blocks ${filled(b.players, 'blocks')}, faceoff% ${filled(b.players, 'faceoffPct')}, TOI ${filled(b.players, 'toiPerGame')}`);
  const player = skaters?.players?.[0];

  await check('goalies', `/api/goalies?season=${season}`, (b) =>
    `${b.total} goalies, save % ${filled(b.goalies, 'savePct')}, GAA ${filled(b.goalies, 'gaa')}, starts ${filled(b.goalies, 'gs')}`);

  await check('percentiles', `/api/percentiles?season=${season}`, (b) =>
    `min ${b.minGp} GP, ${b.poolSize.F} forwards, ${b.poolSize.D} defense ranked`);

  if (player) {
    await check(`player/${player.id}`, `/api/player/${player.id}`, (b) => {
      const bio = b.bio || {};
      const got = ['age', 'birthPlace', 'heightIn', 'weightLb', 'shoots', 'draft'].filter((k) => bio[k] != null);
      return `${b.name}: bio ${got.length}/6 (${got.join(', ')}), ${b.seasons.length} NHL seasons, headshot ${b.headshot ? 'yes' : 'no'}`;
    });
    await check('player gamelog', `/api/player/${player.id}/gamelog?season=${season}`, (b) =>
      `${b.games.length} games, game ids ${filled(b.games, 'gameId')}`);
    await check('player percentiles', `/api/player/${player.id}/percentiles?season=${season}`, (b) =>
      `${b.name}: points/60 ${b.pct.pointsPer60}th, shots/60 ${b.pct.shotsPer60}th percentile`);
  }

  const game = sched?.games?.find((g) => g.result);
  if (game) {
    await check(`game/${game.id}/shots`, `/api/game/${game.id}/shots`, (b) => {
      const s = b.shots;
      const goals = s.filter((x) => x.kind === 'goal').length;
      const bad = s.filter((x) => x.x < 0).length;
      const xg = s.reduce((a, x) => a + x.xg, 0).toFixed(2);
      return `${s.length} attempts, ${goals} goals (final ${b.game.away.score}-${b.game.home.score}), total xG ${xg}, shots in defensive half ${bad}`;
    });
  }

  if (player) {
    await check('player shots', `/api/player/${player.id}/shots?season=${season}`, (b) =>
      `${b.shots.length} attempts over ${b.gamesLoaded}/${b.gamesRequested} games, goals ${b.summary.goals} vs xG ${b.summary.xg}`);
  }

  await check(`team/${team}/shots`, `/api/team/${team}/shots?season=${season}`, (b) =>
    `${b.gamesLoaded}/${b.gamesRequested} games, 5v5 shot attempts share ${b.summary.fiveOnFive.corsiPct}, xG share ${b.summary.fiveOnFive.xgPct}`);

  console.table(rows);
  const failed = rows.filter((r) => r.status === 'FAIL').length;
  console.log(failed
    ? `\n${failed} route(s) failed. Copy this table into the chat so the field names can be fixed.`
    : '\nAll routes returned data. Low percentages in the notes point at fields the NHL may name differently.');
})();
