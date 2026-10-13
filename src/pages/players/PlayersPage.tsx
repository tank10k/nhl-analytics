import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { buildCard } from '../../lib/cards';
import { fmtDec, fmtPct, fmtSigned, fmtToi, seasonLabel } from '../../lib/format';
import type { GameLogEntry, Player, PlayerPercentiles, Skater, SkatersResponse } from '../../lib/types';
import { ErrorNotice, Panel, Segmented, Skeleton, SkeletonRows } from '../../components/Panel';
import { PlayerCard } from '../../components/PlayerCard';
import { TeamStripe } from '../../components/TeamChip';
import { ProductionScatter, per60 } from './ProductionScatter';

type Pos = 'all' | 'F' | 'C' | 'L' | 'R' | 'D';
type GameType = '2' | '3';
type SortKey = 'name' | 'gp' | 'goals' | 'assists' | 'points' | 'pointsPerGame' | 'p60' | 'ppPoints'
  | 'shots' | 'shootingPct' | 'toiPerGame' | 'plusMinus' | 'hits' | 'blocks';

const PAGE = 25;

const COLS: { key: SortKey; label: string; title: string; fmt: (p: Skater) => string; strong?: boolean }[] = [
  { key: 'gp', label: 'GP', title: 'Games played', fmt: (p) => String(p.gp) },
  { key: 'goals', label: 'G', title: 'Goals', fmt: (p) => String(p.goals) },
  { key: 'assists', label: 'A', title: 'Assists', fmt: (p) => String(p.assists) },
  { key: 'points', label: 'P', title: 'Points', fmt: (p) => String(p.points), strong: true },
  { key: 'pointsPerGame', label: 'P/GP', title: 'Points per game', fmt: (p) => fmtDec(p.pointsPerGame) },
  { key: 'p60', label: 'P/60', title: 'Points per 60 minutes', fmt: (p) => fmtDec(per60(p, p.points)) },
  { key: 'ppPoints', label: 'PPP', title: 'Power-play points', fmt: (p) => String(p.ppPoints ?? '–') },
  { key: 'shots', label: 'SOG', title: 'Shots on goal', fmt: (p) => String(p.shots) },
  { key: 'shootingPct', label: 'SH%', title: 'Shooting percentage', fmt: (p) => fmtPct(p.shootingPct) },
  { key: 'toiPerGame', label: 'TOI', title: 'Time on ice per game', fmt: (p) => fmtToi(p.toiPerGame) },
  { key: 'plusMinus', label: '+/−', title: 'Plus/minus', fmt: (p) => fmtSigned(p.plusMinus) },
  { key: 'hits', label: 'HIT', title: 'Hits', fmt: (p) => String(p.hits ?? '–') },
  { key: 'blocks', label: 'BLK', title: 'Blocked shots', fmt: (p) => String(p.blocks ?? '–') },
];

const sortValue = (p: Skater, k: SortKey): number | string =>
  k === 'name' ? p.name : k === 'p60' ? per60(p, p.points) : (p[k] ?? -Infinity);

/** One compact card; loads the profile and last games itself. */
function TopCard({ id, season, pct }: { id: number; season: string; pct?: PlayerPercentiles }) {
  const { link } = useSeason();
  const player = useApi<Player>(`/api/player/${id}`);
  const log = useApi<{ games: GameLogEntry[] }>(`/api/player/${id}/gamelog?season=${season}`);
  if (!player.data) return <Skeleton height={430} style={{ borderRadius: 14 }} />;
  const card = buildCard(player.data, season, { percentiles: pct, games: log.data?.games });
  return <PlayerCard card={card} size="compact" href={link(`/players/${id}`)} />;
}

export function PlayersPage() {
  const { season, link } = useSeason();
  const [gameType, setGameType] = useState<GameType>('2');
  const [pos, setPos] = useState<Pos>('all');
  const [team, setTeam] = useState('');
  const [minGp, setMinGp] = useState(1);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'points', dir: -1 });
  const [page, setPage] = useState(0);

  const skaters = useApi<SkatersResponse>(`/api/skaters?season=${season}&gameType=${gameType}&limit=2000`);
  const pctAll = useApi<{ minGp: number; poolSize: { F: number; D: number }; metrics: PlayerPercentiles['metrics']; players: PlayerPercentiles[] }>(
    gameType === '2' ? `/api/percentiles?season=${season}` : null,
  );

  const all = skaters.data?.players ?? [];
  const teams = useMemo(() => [...new Set(all.flatMap((p) => p.teams))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) =>
      p.gp >= minGp
      && (pos === 'all' || (pos === 'F' ? p.pos !== 'D' : p.pos === pos))
      && (!team || p.teams.includes(team))
      && (!q || p.name.toLowerCase().includes(q)));
  }, [all, minGp, pos, team, query]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, key), bv = sortValue(b, key);
      if (typeof av === 'string' || typeof bv === 'string') return dir * String(av).localeCompare(String(bv));
      return dir * (av - bv) || b.points - a.points;
    });
  }, [filtered, sort]);

  const top = useMemo(() => [...filtered].sort((a, b) => b.points - a.points || a.gp - b.gp).slice(0, 4), [filtered]);
  const pctById = useMemo(() => {
    const m = new Map<number, PlayerPercentiles>();
    const d = pctAll.data;
    if (d) for (const p of d.players) m.set(p.id, { ...p, season, gameType: '2', minGp: d.minGp, poolSize: d.poolSize[p.group], metrics: d.metrics });
    return m;
  }, [pctAll.data, season]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = sorted.slice(cur * PAGE, cur * PAGE + PAGE);

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };
  const onSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }));
    setPage(0);
  };

  const scopeLabel = [
    pos === 'all' ? 'All skaters' : pos === 'F' ? 'Forwards' : pos === 'D' ? 'Defense' : { C: 'Centers', L: 'Left wings', R: 'Right wings' }[pos],
    team && `on ${team}`,
    minGp > 1 && `with ${minGp}+ games`,
  ].filter(Boolean).join(' ');

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Players<span className="season">{seasonLabel(season)}{gameType === '3' ? ' playoffs' : ''}</span></h1>
        <p className="page-lede">Leaderboards for every skater. Open any player for their card, percentile ranks and trends.</p>
      </header>

      <div className="filters" role="group" aria-label="Filters">
        <Segmented label="Season type" value={gameType} onChange={reset(setGameType)}
          options={[{ value: '2', label: 'Regular season' }, { value: '3', label: 'Playoffs' }]} />
        <Segmented label="Position" value={pos} onChange={reset(setPos)}
          options={[{ value: 'all', label: 'All' }, { value: 'F', label: 'F' }, { value: 'C', label: 'C' },
            { value: 'L', label: 'LW' }, { value: 'R', label: 'RW' }, { value: 'D', label: 'D' }]} />
        <label className="field">Team
          <select className="select select-sm" value={team} onChange={(e) => reset(setTeam)(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field">Min. games
          <select className="select select-sm" value={minGp} onChange={(e) => reset(setMinGp)(Number(e.target.value))}>
            {[1, 5, 10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field search-field">
          <span className="sr-only">Find a player</span>
          <input className="input" type="search" placeholder="Find a player" value={query} onChange={(e) => reset(setQuery)(e.target.value)} />
        </label>
      </div>

      {skaters.error && <ErrorNotice error={skaters.error} onRetry={skaters.retry} />}

      {!skaters.error && (
        <>
          <div className="section-head"><h2>Leading scorers</h2><p>{scopeLabel}</p></div>
          {skaters.loading && !skaters.data ? (
            <div className="card-row">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={430} style={{ borderRadius: 14 }} />)}</div>
          ) : top.length ? (
            <div className="card-row">
              {top.map((p) => <TopCard key={`${p.id}-${season}`} id={p.id} season={season} pct={pctById.get(p.id)} />)}
            </div>
          ) : <p className="empty">No players match these filters.</p>}

          <div className="grid-players">
            <Panel title="Production and ice time" sub={`${scopeLabel}. Higher means more scoring per minute played.`}>
              {skaters.data ? <ProductionScatter players={filtered} /> : <Skeleton height={400} />}
            </Panel>
          </div>

          <Panel
            title="Leaderboard"
            sub={`${sorted.length} player${sorted.length === 1 ? '' : 's'}. Select a column to sort.`}
            className="leaderboard"
          >
            {!skaters.data ? <SkeletonRows rows={12} /> : (
              <>
                <div className="table-scroll">
                  <table className="table sortable">
                    <thead>
                      <tr>
                        <th scope="col" className="rank-col">#</th>
                        <th scope="col" aria-sort={sort.key === 'name' ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                          <button type="button" onClick={() => onSort('name')}>Player</button>
                        </th>
                        <th scope="col">Pos</th>
                        {COLS.map((c) => (
                          <th key={c.key} scope="col" title={c.title}
                            aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                            <button type="button" onClick={() => onSort(c.key)}>
                              {c.label}{sort.key === c.key && <span aria-hidden>{sort.dir === -1 ? ' ↓' : ' ↑'}</span>}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p, i) => {
                        const t = p.teams[p.teams.length - 1];
                        return (
                          <tr key={p.id}>
                            <td className="rank">{cur * PAGE + i + 1}</td>
                            <td>
                              <span className="team-chip">
                                <TeamStripe abbrev={t} />
                                <Link className="player-link" to={link(`/players/${p.id}`)}>{p.name}</Link>
                                <span className="muted">{p.teams.join('/')}</span>
                              </span>
                            </td>
                            <td className="muted">{p.pos}</td>
                            {COLS.map((c) => (
                              <td key={c.key} className={c.strong ? 'num-strong' : sort.key === c.key ? 'sorted' : undefined}>{c.fmt(p)}</td>
                            ))}
                          </tr>
                        );
                      })}
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
              </>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
