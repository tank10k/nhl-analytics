import { api, esc, signed, seasonLabel, initTheme, initSeasonSelect } from './common.js';
import { renderBars, renderLines } from './charts.js';

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get('id');

const METRICS = { points: 'Points', goals: 'Goals', assists: 'Assists', shots: 'Shots on goal' };

let season, player = null, seasons = []; // seasons: aggregated NHL regular seasons, oldest first
let metric = 'points', match = true, compare = null; // compare: null = not chosen yet, '' = None
const logs = new Map();                  // season -> games (oldest first)
let token = 0;

const fail = (msg) => { $('errorText').textContent = msg; $('error').hidden = false; $('loading').hidden = true; };

// Landing data has one row per team stint; combine them into one row per season.
function aggregate(rows) {
  const by = new Map();
  for (const r of rows) {
    const a = by.get(r.season) || { season: r.season, teams: [], gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0, plusMinus: 0 };
    if (r.team && !a.teams.includes(r.team)) a.teams.push(r.team);
    for (const k of ['gp', 'goals', 'assists', 'points', 'shots', 'pim', 'plusMinus']) a[k] += r[k] || 0;
    by.set(r.season, a);
  }
  return [...by.values()].sort((a, b) => a.season.localeCompare(b.season));
}

async function getLog(s) {
  if (!logs.has(s)) {
    const d = await api(`/api/player/${encodeURIComponent(id)}/gamelog?season=${encodeURIComponent(s)}`);
    logs.set(s, [...d.games].sort((a, b) => String(a.date).localeCompare(String(b.date))));
  }
  return logs.get(s);
}

function renderProfile() {
  const p = player;
  document.title = `${p.name} – NHL Analytics`;
  $('profile').innerHTML =
    (p.headshot ? `<img src="${esc(p.headshot)}" alt="" onerror="this.style.display='none'">` : '') +
    `<div><h1>${esc(p.name)}</h1><p>${[p.team, p.pos, p.number != null ? `#${p.number}` : null].filter(Boolean).map(esc).join(' · ')}</p></div>`;
}

function renderCareer() {
  renderBars($('chartCareer'), {
    mode: 'stacked', label: 'Goals and assists by season', labelWidth: 72,
    series: [
      { key: 'goals', name: 'Goals', color: 'var(--s1)' },
      { key: 'assists', name: 'Assists', color: 'var(--s2)' },
    ],
    rows: seasons.map((s) => ({
      label: seasonLabel(s.season), values: { goals: s.goals, assists: s.assists }, valueLabel: `${s.points} pts`,
      tip: `<b>${seasonLabel(s.season)}</b>` +
        `<div class="r"><span>Team</span><span>${esc(s.teams.join('/'))}</span></div>` +
        `<div class="r"><span>Games played</span><span>${s.gp}</span></div>` +
        `<div class="r"><span>G · A · PTS</span><span>${s.goals} · ${s.assists} · ${s.points}</span></div>` +
        `<div class="r"><span>Shots</span><span>${s.shots}</span></div>`,
    })),
  });
}

function renderTiles(games) {
  const sum = (k) => games.reduce((a, g) => a + (g[k] || 0), 0);
  const gp = games.length, goals = sum('goals'), shots = sum('shots'), pts = sum('points');
  const tiles = [
    ['Games', gp, 'Regular season'],
    ['Goals', goals, shots ? `${((goals / shots) * 100).toFixed(1)}% shooting` : 'no shots yet'],
    ['Assists', sum('assists'), ''],
    ['Points', pts, gp ? `${(pts / gp).toFixed(2)} per game` : ''],
    ['Shots on goal', shots, gp ? `${(shots / gp).toFixed(1)} per game` : ''],
    ['Plus/minus', signed(sum('plusMinus')), `${sum('pim')} PIM`],
  ];
  $('tiles').innerHTML = tiles.map(([k, v, d]) =>
    `<div class="tile"><div class="k">${k}</div><div class="v">${esc(v)}</div><div class="d">${esc(d)}</div></div>`).join('');
}

function cumulative(games, name, color, dash) {
  let run = 0;
  return {
    name, color, dash,
    points: games.map((g, i) => {
      run += g[metric] || 0;
      return { x: i + 1, y: run, tip: `${run} (${g[metric] || 0} ${g.homeRoad === 'R' ? '@' : 'vs'} ${esc(g.opp)})` };
    }),
  };
}

function renderTrend(games, cmpGames) {
  const series = [cumulative(games, seasonLabel(season), 'var(--s1)')];
  if (compare && cmpGames) {
    // Pace view: when this season is in progress, only compare the same number of games.
    const trim = match && games.length > 0 && games.length < cmpGames.length;
    const g = trim ? cmpGames.slice(0, games.length) : cmpGames;
    series.push(cumulative(g, seasonLabel(compare) + (trim ? ` (first ${g.length} games)` : ''), 'var(--s2)', '6 4'));
  }
  renderLines($('chartTrend'), {
    series, xLabel: 'Games played', yLabel: `${METRICS[metric]} (running total)`,
    label: `Running total of ${METRICS[metric].toLowerCase()} by game`,
  });
}

function renderTable(games) {
  const rows = [...games].reverse();
  const cols = [
    ['Date', (g) => g.date, true], ['Opp', (g) => `${g.homeRoad === 'R' ? '@ ' : ''}${g.opp}`, true],
    ['G', (g) => g.goals], ['A', (g) => g.assists], ['PTS', (g) => g.points, false, true], ['SOG', (g) => g.shots],
    ['+/−', (g) => signed(g.plusMinus)], ['PIM', (g) => g.pim], ['TOI', (g) => g.toi ?? '–'],
  ];
  $('table').innerHTML = '<thead><tr>' + cols.map(([l, , left]) => `<th scope="col" class="${left ? 'l' : ''}">${l}</th>`).join('') + '</tr></thead><tbody>' +
    (rows.map((g) => '<tr>' + cols.map(([, f, left, bold]) => `<td class="${left ? 'l' : ''}${bold ? ' hi' : ''}">${esc(f(g))}</td>`).join('') + '</tr>').join('') ||
      `<tr><td colspan="${cols.length}">No games played in ${seasonLabel(season)}.</td></tr>`) + '</tbody>';
  $('logCount').textContent = `${rows.length} game${rows.length === 1 ? '' : 's'} in ${seasonLabel(season)}.`;
}

function buildCompareOptions() {
  const others = seasons.map((s) => s.season).filter((s) => s !== season).reverse();
  $('compare').innerHTML = '<option value="">None</option>' + others.map((s) => `<option value="${s}">${seasonLabel(s)}</option>`).join('');
  // default: the closest earlier season the player has data for
  if (compare === null || (compare !== '' && !others.includes(compare))) compare = others.find((s) => s < season) || '';
  $('compare').value = compare;
}

async function renderSeasonViews() {
  const mine = ++token;
  $('error').hidden = true;
  buildCompareOptions();
  try {
    const [games, cmp] = await Promise.all([getLog(season), compare ? getLog(compare) : null]);
    if (mine !== token) return;
    renderTiles(games);
    renderTrend(games, cmp);
    renderTable(games);
  } catch (err) {
    if (mine === token) fail(`Couldn’t load games: ${err.message}`);
  }
}

async function init() {
  initTheme($('theme'));
  if (!id || !/^\d+$/.test(id)) { fail('No player selected. Pick one from the Players page.'); return; }
  try {
    season = await initSeasonSelect($('season'), (s) => { season = s; renderSeasonViews(); });
    $('back').href = `/players.html?season=${encodeURIComponent(season)}`;
    player = await api(`/api/player/${encodeURIComponent(id)}`);
    seasons = aggregate(player.seasons);
    renderProfile();
    renderCareer();
    await renderSeasonViews();
  } catch (err) {
    fail(`Couldn’t load player: ${err.message}`);
  } finally {
    $('loading').hidden = true;
  }
}

$('metric').addEventListener('change', (e) => { metric = e.target.value; renderSeasonViews(); });
$('match').addEventListener('change', (e) => { match = e.target.checked; renderSeasonViews(); });
$('compare').addEventListener('change', (e) => { compare = e.target.value; renderSeasonViews(); });
$('retry').addEventListener('click', init);
init();
