import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { fmtDec, fmtSv, seasonLabel } from '../../lib/format';
import { goalieLeague, goalieRanks, type GoalieRow } from '../../lib/goalies';
import type { GoaliesResponse } from '../../lib/types';
import { ErrorNotice, Panel, Segmented, Skeleton, SkeletonRows } from '../../components/Panel';
import { PlayerCardLoader } from '../../components/PlayerCardLoader';
import { TeamStripe } from '../../components/TeamChip';
import { GsaaBars, WorkloadScatter } from './GoalieCharts';
import { usePageTitle } from '../../lib/title';

type GameType = '2' | '3';
type SortKey = 'name' | 'gp' | 'gs' | 'wins' | 'losses' | 'otLosses' | 'savePct' | 'gaa' | 'shutouts'
  | 'shotsAgainst' | 'saves' | 'saPer60' | 'gsaa' | 'toi';

const PAGE = 25;
const signed = (v: number | null) => (v == null ? '–' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`);

const COLS: { key: SortKey; label: string; title: string; fmt: (g: GoalieRow) => string; strong?: boolean; lowFirst?: boolean }[] = [
  { key: 'gp', label: 'GP', title: 'Games played', fmt: (g) => String(g.gp) },
  { key: 'gs', label: 'GS', title: 'Games started', fmt: (g) => String(g.gs ?? '–') },
  { key: 'wins', label: 'W', title: 'Wins', fmt: (g) => String(g.wins ?? '–') },
  { key: 'losses', label: 'L', title: 'Losses', fmt: (g) => String(g.losses ?? '–') },
  { key: 'otLosses', label: 'OTL', title: 'Overtime and shootout losses', fmt: (g) => String(g.otLosses ?? '–') },
  { key: 'savePct', label: 'SV%', title: 'Save percentage', fmt: (g) => fmtSv(g.savePct), strong: true },
  { key: 'gaa', label: 'GAA', title: 'Goals against average (lower is better)', fmt: (g) => fmtDec(g.gaa), lowFirst: true },
  { key: 'gsaa', label: 'GSAA', title: 'Goals saved above a league-average goalie on the same shots', fmt: (g) => signed(g.gsaa) },
  { key: 'shutouts', label: 'SO', title: 'Shutouts', fmt: (g) => String(g.shutouts ?? '–') },
  { key: 'shotsAgainst', label: 'SA', title: 'Shots against', fmt: (g) => String(g.shotsAgainst ?? '–') },
  { key: 'saves', label: 'SV', title: 'Saves', fmt: (g) => String(g.saves ?? '–') },
  { key: 'saPer60', label: 'SA/60', title: 'Shots against per 60 minutes', fmt: (g) => fmtDec(g.saPer60, 1) },
  { key: 'toi', label: 'MIN', title: 'Total minutes played', fmt: (g) => (g.toi != null ? Math.round(g.toi / 60).toLocaleString() : '–') },
];

const sortValue = (g: GoalieRow, k: SortKey): number | string => (k === 'name' ? g.name : (g[k] as number | null) ?? Number.NaN);

export function GoaliesPage() {
  usePageTitle('Goalies');
  const { season, link } = useSeason();
  const [gameType, setGameType] = useState<GameType>('2');
  const [team, setTeam] = useState('');
  const [minGp, setMinGp] = useState<number | 'auto'>('auto');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'gsaa', dir: -1 });
  const [page, setPage] = useState(0);

  const res = useApi<GoaliesResponse>(`/api/goalies?season=${season}&gameType=${gameType}&limit=500`);
  const league = useMemo(() => (res.data ? goalieLeague(res.data.goalies) : null), [res.data]);
  const rows = league?.rows ?? [];
  const teams = useMemo(() => [...new Set(rows.flatMap((g) => g.teams))].sort(), [rows]);
  const floor = minGp === 'auto' ? league?.minGp ?? 1 : minGp;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((g) => g.gp >= floor && (!team || g.teams.includes(team)) && (!q || g.name.toLowerCase().includes(q)));
  }, [rows, floor, team, query]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, key), bv = sortValue(b, key);
      if (typeof av === 'string' || typeof bv === 'string') return dir * String(av).localeCompare(String(bv));
      if (Number.isNaN(av) !== Number.isNaN(bv)) return Number.isNaN(av) ? 1 : -1; // blanks last
      return dir * (av - bv) || (b.gsaa ?? 0) - (a.gsaa ?? 0);
    });
  }, [filtered, sort]);

  const top = useMemo(() => [...filtered].sort((a, b) => (b.gsaa ?? -99) - (a.gsaa ?? -99)).slice(0, 4), [filtered]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = sorted.slice(cur * PAGE, cur * PAGE + PAGE);

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };
  const onSort = (key: SortKey, lowFirst?: boolean) => {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' || lowFirst ? 1 : -1 }));
    setPage(0);
  };

  const scope = [team ? `${team} goalies` : 'Goalies', `with ${floor}+ games`].join(' ');
  const best = top[0];

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Goalies<span className="season">{seasonLabel(season)}{gameType === '3' ? ' playoffs' : ''}</span></h1>
        <p className="page-lede">
          {league && league.leagueSv != null && best?.gsaa != null ? (
            <>League save percentage is <strong>{fmtSv(league.leagueSv)}</strong>. <strong>{best.name}</strong> has saved the most goals above an average goalie: <strong>{signed(best.gsaa)}</strong>.</>
          ) : 'Save percentage, workload and goals saved above average for every goalie.'}
        </p>
      </header>

      <div className="filters" role="group" aria-label="Filters">
        <Segmented label="Season type" value={gameType} onChange={reset(setGameType)}
          options={[{ value: '2', label: 'Regular season' }, { value: '3', label: 'Playoffs' }]} />
        <label className="field">Team
          <select className="select select-sm" value={team} onChange={(e) => reset(setTeam)(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field">Min. games
          <select className="select select-sm" value={String(minGp)}
            onChange={(e) => reset(setMinGp)(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
            <option value="auto">Qualified ({league?.minGp ?? '…'}+)</option>
            {[1, 5, 10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field search-field">
          <span className="sr-only">Find a goalie</span>
          <input className="input" type="search" placeholder="Find a goalie" value={query} onChange={(e) => reset(setQuery)(e.target.value)} />
        </label>
      </div>

      {res.error && <ErrorNotice error={res.error} onRetry={res.retry} />}

      {!res.error && (
        <>
          <div className="section-head"><h2>Saving the most</h2><p>{scope}, ranked by goals saved above average</p></div>
          {!res.data ? (
            <div className="card-row">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={430} style={{ borderRadius: 14 }} />)}</div>
          ) : top.length ? (
            <div className="card-row">
              {top.map((g) => <PlayerCardLoader key={`${g.id}-${season}`} id={g.id} season={season} goalieRanks={goalieRanks(league, g.id)} />)}
            </div>
          ) : <p className="empty">No goalies match these filters.</p>}

          <div className="grid-goalies">
            <Panel title="Goals saved above average" sub={`${scope}. Compared with a league-average goalie facing the same number of shots.`}>
              {res.data ? <GsaaBars rows={filtered} /> : <Skeleton height={420} />}
            </Panel>
            <Panel title="Workload and quality" sub="Games started against save %. Dashed lines mark the league save % and the median number of starts. Dot size follows games played; click a goalie to open him.">
              {res.data ? <WorkloadScatter rows={filtered} leagueSv={league?.leagueSv ?? null} /> : <Skeleton height={500} />}
            </Panel>
          </div>

          <Panel title="Leaderboard" sub={`${sorted.length} goalie${sorted.length === 1 ? '' : 's'}. Select a column to sort.`} className="leaderboard goalie-board">
            {!res.data ? <SkeletonRows rows={12} /> : (
              <>
                <div className="table-scroll">
                  <table className="table sortable">
                    <thead>
                      <tr>
                        <th scope="col" className="rank-col">#</th>
                        <th scope="col" className="name-col" aria-sort={sort.key === 'name' ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                          <button type="button" onClick={() => onSort('name')}>Goalie</button>
                        </th>
                        {COLS.map((c) => (
                          <th key={c.key} scope="col" title={c.title}
                            aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                            <button type="button" onClick={() => onSort(c.key, c.lowFirst)}>
                              {c.label}{sort.key === c.key && <span aria-hidden>{sort.dir === -1 ? ' ↓' : ' ↑'}</span>}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((g, i) => (
                        <tr key={g.id}>
                          <td className="rank">{cur * PAGE + i + 1}</td>
                          <td className="name-col">
                            <span className="team-chip">
                              <TeamStripe abbrev={g.teams[g.teams.length - 1]} />
                              <Link className="player-link" to={link(`/players/${g.id}`)}>{g.name}</Link>
                              <span className="muted">{g.teams.join('/')}</span>
                            </span>
                          </td>
                          {COLS.map((c) => (
                            <td key={c.key} className={c.strong ? 'num-strong' : sort.key === c.key ? 'sorted' : c.key === 'gsaa' ? ((g.gsaa ?? 0) >= 0 ? 'pos' : 'neg') : undefined}>{c.fmt(g)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pages > 1 && (
                  <div className="pager">
                    <button type="button" className="btn" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</button>
                    <span>Page {cur + 1} of {pages}</span>
                    <button type="button" className="btn" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button>
                  </div>
                )}
                <p className="table-note">
                  GSAA (goals saved above average) = saves minus the saves a goalie with the league save percentage
                  {league?.leagueSv != null ? ` (${fmtSv(league.leagueSv)})` : ''} would make on the same shots. It doesn't account for shot quality;
                  each goalie's page has goals saved above <em>expected</em>, which does.
                </p>
              </>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
