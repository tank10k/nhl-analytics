import { api, esc, signed, fmtPct, rec, initTheme, initSeasonSelect } from './common.js';
import { renderBars } from './charts.js';

const $ = (id) => document.getElementById(id);

let season, teams = [];
let scope = 'all';
let order = 'points';
let sort = { key: 'points', dir: 'desc' };

// Table columns. `get` is the sort value, `show` the displayed text.
const COLS = [
  { key: 'team', label: 'Team', left: true, get: (t) => t.name, first: 'asc' },
  { key: 'gp', label: 'GP', get: (t) => t.gp },
  { key: 'wins', label: 'W', get: (t) => t.wins },
  { key: 'losses', label: 'L', get: (t) => t.losses },
  { key: 'otLosses', label: 'OTL', get: (t) => t.otLosses },
  { key: 'points', label: 'PTS', get: (t) => t.points, bold: true },
  { key: 'pointPct', label: 'P%', get: (t) => t.pointPct, show: (t) => fmtPct(t.pointPct) },
  { key: 'regWins', label: 'RW', get: (t) => t.regWins },
  { key: 'gf', label: 'GF', get: (t) => t.gf },
  { key: 'ga', label: 'GA', get: (t) => t.ga },
  { key: 'goalDiff', label: 'DIFF', get: (t) => t.goalDiff, show: (t) => signed(t.goalDiff) },
  { key: 'home', label: 'HOME', get: (t) => t.home.w, show: (t) => rec(t.home) },
  { key: 'road', label: 'ROAD', get: (t) => t.road.w, show: (t) => rec(t.road) },
  { key: 'l10', label: 'L10', get: (t) => t.l10.w, show: (t) => rec(t.l10) },
  { key: 'streak', label: 'STRK', get: (t) => t.streak || '', show: (t) => t.streak || '–' },
];

const inScope = (t) =>
  scope === 'all' || (scope.startsWith('conf:') ? t.conference === scope.slice(5) : t.division === scope.slice(4));

function buildScopeOptions() {
  const confs = [...new Set(teams.map((t) => t.conference))].filter(Boolean).sort();
  const divs = [...new Set(teams.map((t) => t.division))].filter(Boolean).sort();
  $('scope').innerHTML =
    '<option value="all">All teams</option>' +
    (confs.length ? `<optgroup label="Conference">${confs.map((c) => `<option value="conf:${esc(c)}">${esc(c)}</option>`).join('')}</optgroup>` : '') +
    (divs.length ? `<optgroup label="Division">${divs.map((d) => `<option value="div:${esc(d)}">${esc(d)}</option>`).join('')}</optgroup>` : '');
  if (![...$('scope').options].some((o) => o.value === scope)) scope = 'all';
  $('scope').value = scope;
}

const byDesc = (key) => (a, b) => (b[key] ?? 0) - (a[key] ?? 0) || b.points - a.points || b.goalDiff - a.goalDiff;

function tipHtml(t) {
  const row = (k, v) => `<div class="r"><span>${k}</span><span>${v}</span></div>`;
  return `<b>${esc(t.name)}</b>` +
    row('Record (W-L-OTL)', `${t.wins}-${t.losses}-${t.otLosses}`) +
    row('Points', `${t.points} in ${t.gp} GP (${fmtPct(t.pointPct)})`) +
    row('Goals for / against', `${t.gf} / ${t.ga}`) +
    row('Goal differential', signed(t.goalDiff)) +
    row('Last 10', rec(t.l10)) +
    row('Streak', t.streak || '–');
}

function renderTiles(list) {
  const best = (score) => list.reduce((a, t) => (a === null || score(t) > score(a) ? t : a), null);
  const per = (n, gp) => (gp ? (n / gp).toFixed(2) : '0.00');
  const defs = [
    ['Most points', best((t) => t.points), (t) => t.points, (t) => `${t.name} · ${t.gp} GP`],
    ['Best goal differential', best((t) => t.goalDiff), (t) => signed(t.goalDiff), (t) => `${t.name} · ${t.gf} GF, ${t.ga} GA`],
    ['Top offense', best((t) => (t.gp ? t.gf / t.gp : 0)), (t) => per(t.gf, t.gp), (t) => `${t.name} · goals per game`],
    ['Top defense', best((t) => (t.gp ? -t.ga / t.gp : 0)), (t) => per(t.ga, t.gp), (t) => `${t.name} · goals against per game`],
  ];
  $('tiles').innerHTML = defs.map(([k, t, v, d]) => t ? `
    <div class="tile"><div class="k">${k}</div>
      <div class="v">${t.logo ? `<img src="${esc(t.logo)}" alt="" onerror="this.style.display='none'">` : ''}${esc(t.abbrev)} <span>${esc(v(t))}</span></div>
      <div class="d">${esc(d(t))}</div></div>` : '').join('');
}

function renderCharts(list) {
  const sorted = [...list].sort(byDesc(order));
  renderBars($('chartRecord'), {
    mode: 'stacked', label: 'Wins, losses and overtime losses by team',
    series: [
      { key: 'wins', name: 'Wins', color: 'var(--s1)' },
      { key: 'losses', name: 'Losses', color: 'var(--s2)' },
      { key: 'otLosses', name: 'OT losses', color: 'var(--s3)' },
    ],
    rows: sorted.map((t) => ({
      label: t.abbrev, values: { wins: t.wins, losses: t.losses, otLosses: t.otLosses },
      valueLabel: `${t.wins}-${t.losses}-${t.otLosses}`, tip: tipHtml(t),
    })),
  });
  renderBars($('chartDiff'), {
    mode: 'diverging', label: 'Goal differential by team',
    series: [
      { name: 'More goals for than against', color: 'var(--s1)' },
      { name: 'More goals against than for', color: 'var(--neg)' },
    ],
    rows: sorted.map((t) => ({ label: t.abbrev, value: t.goalDiff, valueLabel: signed(t.goalDiff), tip: tipHtml(t) })),
  });
}

function renderTable(list) {
  const col = COLS.find((c) => c.key === sort.key) || COLS[5];
  const dir = sort.dir === 'asc' ? 1 : -1;
  const rows = [...list].sort((a, b) => {
    const x = col.get(a), y = col.get(b);
    const c = typeof x === 'string' ? x.localeCompare(y) : (x ?? 0) - (y ?? 0);
    return dir * c || b.points - a.points;
  });
  const head = COLS.map((c) =>
    `<th scope="col" class="${c.left ? 'l' : ''}" ${c.key === sort.key ? `aria-sort="${sort.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>` +
    `<button type="button" data-key="${c.key}">${c.label}</button></th>`).join('');
  const body = rows.map((t) => '<tr>' + COLS.map((c) => {
    if (c.key === 'team') {
      return `<td class="l"><span class="team">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}` +
        `${esc(t.name)} <span>${esc(t.abbrev)}</span></span></td>`;
    }
    const v = c.show ? c.show(t) : c.get(t);
    return `<td class="${c.bold ? 'hi' : ''}">${esc(v)}</td>`;
  }).join('') + '</tr>').join('');
  $('table').innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="15">No teams.</td></tr>'}</tbody>`;
}

function render() {
  const list = teams.filter(inScope);
  renderTiles(list);
  renderCharts(list);
  renderTable(list);
}

async function load(id) {
  season = id;
  $('error').hidden = true;
  $('loading').hidden = false;
  try {
    const d = await api(`/api/standings?season=${encodeURIComponent(id)}`);
    if (id !== season) return; // a newer request replaced this one
    teams = d.teams;
    buildScopeOptions();
    render();
  } catch (err) {
    $('errorText').textContent = `Couldn’t load standings: ${err.message}`;
    $('error').hidden = false;
    teams = [];
    render();
  } finally {
    $('loading').hidden = true;
  }
}

$('scope').addEventListener('change', (e) => { scope = e.target.value; render(); });
$('order').addEventListener('change', (e) => { order = e.target.value; render(); });
$('retry').addEventListener('click', () => load(season));
$('table').addEventListener('click', (e) => {
  const key = e.target.closest('button')?.dataset.key;
  if (!key) return;
  const col = COLS.find((c) => c.key === key);
  sort = sort.key === key
    ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: col.first || 'desc' };
  render();
});

initTheme($('theme'));
initSeasonSelect($('season'), load).then(load).catch((err) => {
  $('errorText').textContent = `Couldn’t load seasons: ${err.message}`;
  $('error').hidden = false;
  $('loading').hidden = true;
});
