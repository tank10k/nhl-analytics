import { api, esc, signed, initTheme, initSeasonSelect } from './common.js';
import { renderBars, renderScatter } from './charts.js';

const $ = (id) => document.getElementById(id);
const PAGE = 50;

let season, all = [];
const f = { gameType: '2', team: 'all', pos: 'all', minGp: 1, q: '' };
let sort = { key: 'points', dir: 'desc' };
let shown = PAGE;

// ---- formatting ----
const pct = (v) => (v == null ? '–' : `${(v * 100).toFixed(1)}%`);
const toi = (s) => {
  if (s == null) return '–';
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
function short(name) {
  const parts = String(name).trim().split(/\s+/);
  const s = parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
  return s.length > 15 ? `${s.slice(0, 14)}…` : s;
}
const teamText = (p) => p.teams.join('/');

const COLS = [
  { key: 'name', label: 'Player', left: true, first: 'asc', get: (p) => p.name },
  { key: 'team', label: 'Team', left: true, first: 'asc', get: teamText },
  { key: 'pos', label: 'Pos', left: true, first: 'asc', get: (p) => p.pos },
  { key: 'gp', label: 'GP', get: (p) => p.gp },
  { key: 'goals', label: 'G', get: (p) => p.goals },
  { key: 'assists', label: 'A', get: (p) => p.assists },
  { key: 'points', label: 'PTS', get: (p) => p.points, bold: true },
  { key: 'pointsPerGame', label: 'P/GP', get: (p) => p.pointsPerGame, show: (p) => (p.pointsPerGame ?? 0).toFixed(2) },
  { key: 'shots', label: 'SOG', get: (p) => p.shots },
  { key: 'shootingPct', label: 'SH%', get: (p) => p.shootingPct, show: (p) => pct(p.shootingPct) },
  { key: 'plusMinus', label: '+/−', get: (p) => p.plusMinus, show: (p) => signed(p.plusMinus) },
  { key: 'pim', label: 'PIM', get: (p) => p.pim },
  { key: 'toiPerGame', label: 'TOI/G', get: (p) => p.toiPerGame, show: (p) => toi(p.toiPerGame) },
];

// ---- filtering ----
const posOk = (p) => f.pos === 'all' || (f.pos === 'F' ? p.pos !== 'D' : p.pos === f.pos);
const filtered = () => all.filter((p) =>
  (f.team === 'all' || p.teams.includes(f.team)) && posOk(p) && p.gp >= f.minGp &&
  (!f.q || p.name.toLowerCase().includes(f.q)));

function buildTeamOptions() {
  const teams = [...new Set(all.flatMap((p) => p.teams))].sort();
  $('team').innerHTML = '<option value="all">All teams</option>' + teams.map((t) => `<option>${esc(t)}</option>`).join('');
  if (!teams.includes(f.team)) f.team = 'all';
  $('team').value = f.team;
}

// ---- views ----
function tipHtml(p) {
  const row = (k, v) => `<div class="r"><span>${k}</span><span>${v}</span></div>`;
  return `<b>${esc(p.name)}</b>` +
    row('Team · Pos', `${esc(teamText(p))} · ${esc(p.pos)}`) +
    row('Games played', p.gp) +
    row('Goals · Assists · Points', `${p.goals} · ${p.assists} · ${p.points}`) +
    row('Shots (SH%)', `${p.shots} (${pct(p.shootingPct)})`) +
    row('Plus/minus', signed(p.plusMinus));
}

function renderTiles(list) {
  const defs = [['Points', 'points'], ['Goals', 'goals'], ['Assists', 'assists'], ['Shots on goal', 'shots']];
  $('tiles').innerHTML = defs.map(([label, key]) => {
    let best = null;
    for (const p of list) if (best === null || p[key] > best[key]) best = p;
    if (!best) return '';
    const tied = list.filter((p) => p[key] === best[key]).length - 1;
    return `<div class="tile"><div class="k">${label} leader</div>
      <div class="v">${esc(best[key])}</div>
      <div class="d">${esc(best.name)} · ${esc(teamText(best))} · ${best.gp} GP${tied ? ` · +${tied} tied` : ''}</div></div>`;
  }).join('');
}

const top = (list, key, n = 15) =>
  [...list].sort((a, b) => b[key] - a[key] || b.points - a.points || b.goals - a.goals).slice(0, n);

function renderCharts(list) {
  renderBars($('chartPoints'), {
    mode: 'stacked', label: 'Points leaders, goals and assists', labelWidth: 112,
    series: [
      { key: 'goals', name: 'Goals', color: 'var(--s1)' },
      { key: 'assists', name: 'Assists', color: 'var(--s2)' },
    ],
    rows: top(list, 'points').map((p) => ({
      label: short(p.name), values: { goals: p.goals, assists: p.assists },
      valueLabel: `${p.points} pts`, tip: tipHtml(p),
    })),
  });
  renderBars($('chartShots'), {
    mode: 'stacked', label: 'Shots on goal leaders', labelWidth: 112,
    series: [{ key: 'shots', name: 'Shots on goal', color: 'var(--s3)' }],
    rows: top(list, 'shots').map((p) => ({
      label: short(p.name), values: { shots: p.shots }, valueLabel: `${p.shots} SOG`, tip: tipHtml(p),
    })),
  });
  renderScatter($('chartScatter'), {
    label: 'Shots on goal versus goals for each player', xLabel: 'Shots on goal', yLabel: 'Goals', labelTop: 6,
    points: list.filter((p) => p.shots > 0).map((p) => ({ x: p.shots, y: p.goals, label: short(p.name), tip: tipHtml(p) })),
  });
}

function renderTable(list) {
  const col = COLS.find((c) => c.key === sort.key) || COLS[6];
  const dir = sort.dir === 'asc' ? 1 : -1;
  const rows = [...list].sort((a, b) => {
    const x = col.get(a), y = col.get(b);
    const c = typeof x === 'string' ? x.localeCompare(y) : (x ?? 0) - (y ?? 0);
    return dir * c || b.points - a.points || b.goals - a.goals;
  });
  const head = '<th scope="col">#</th>' + COLS.map((c) =>
    `<th scope="col" class="${c.left ? 'l' : ''}" ${c.key === sort.key ? `aria-sort="${sort.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>` +
    `<button type="button" data-key="${c.key}">${c.label}</button></th>`).join('');
  const body = rows.slice(0, shown).map((p, i) => `<tr><td>${i + 1}</td>` + COLS.map((c) => {
    const v = c.show ? c.show(p) : c.get(p);
    if (c.key === 'name') return `<td class="l"><a class="plink" href="/player.html?id=${p.id}&season=${encodeURIComponent(season)}">${esc(v)}</a></td>`;
    return `<td class="${c.left ? 'l' : ''}${c.bold ? ' hi' : ''}">${esc(v)}</td>`;
  }).join('') + '</tr>').join('');
  $('table').innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${COLS.length + 1}">No players match.</td></tr>`}</tbody>`;
  $('count').textContent = `${rows.length} player${rows.length === 1 ? '' : 's'}. Click a column to sort.`;
  const left = rows.length - shown;
  $('more').hidden = left <= 0;
  $('more').innerHTML = left > 0 ? `Showing ${shown} of ${rows.length} <button class="btn" type="button" id="moreBtn">Show ${Math.min(PAGE, left)} more</button>` : '';
}

function render() {
  const list = filtered();
  renderTiles(list);
  renderCharts(list);
  renderTable(list);
}

async function load(id) {
  season = id;
  $('error').hidden = true;
  $('loading').hidden = false;
  try {
    const d = await api(`/api/skaters?season=${encodeURIComponent(id)}&gameType=${f.gameType}&limit=2000`);
    if (id !== season) return;
    all = d.players;
    buildTeamOptions();
    shown = PAGE;
    render();
  } catch (err) {
    $('errorText').textContent = `Couldn’t load players: ${err.message}`;
    $('error').hidden = false;
    all = [];
    render();
  } finally {
    $('loading').hidden = true;
  }
}

// ---- events ----
const refilter = () => { shown = PAGE; render(); };
$('team').addEventListener('change', (e) => { f.team = e.target.value; refilter(); });
$('pos').addEventListener('change', (e) => { f.pos = e.target.value; refilter(); });
$('minGp').addEventListener('change', (e) => { f.minGp = Number(e.target.value); refilter(); });
$('q').addEventListener('input', (e) => { f.q = e.target.value.trim().toLowerCase(); refilter(); });
$('gameType').addEventListener('change', (e) => { f.gameType = e.target.value; load(season); });
$('retry').addEventListener('click', () => load(season));
$('more').addEventListener('click', (e) => { if (e.target.id === 'moreBtn') { shown += PAGE; render(); } });
$('table').addEventListener('click', (e) => {
  const key = e.target.closest('button')?.dataset.key;
  if (!key) return;
  const col = COLS.find((c) => c.key === key);
  sort = sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: col.first || 'desc' };
  shown = PAGE;
  render();
});

initTheme($('theme'));
initSeasonSelect($('season'), load).then(load).catch((err) => {
  $('errorText').textContent = `Couldn’t load seasons: ${err.message}`;
  $('error').hidden = false;
  $('loading').hidden = true;
});
