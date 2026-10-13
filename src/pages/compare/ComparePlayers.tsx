import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { EChartsOption } from 'echarts';
import { useApi, useApiMany } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { chronological } from '../../lib/cards';
import { fmtDec, fmtMetric, fmtPct, fmtSigned, fmtToi } from '../../lib/format';
import type { PercentilesTable } from '../../lib/stats';
import type { GameLogEntry, PercentileKey, Skater, SkatersResponse } from '../../lib/types';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { Radar } from '../../charts/Radar';
import { ErrorNotice, Panel, Segmented, Skeleton } from '../../components/Panel';
import { PlayerCardLoader, percentileMap } from '../../components/PlayerCardLoader';
import { per60 } from '../players/ProductionScatter';
import { PlayerPicker, SLOT_COLORS, SLOT_HEX } from './Pickers';

const RADAR: { key: PercentileKey; label: string }[] = [
  { key: 'pointsPer60', label: 'Points/60' },
  { key: 'goalsPer60', label: 'Goals/60' },
  { key: 'assistsPer60', label: 'Assists/60' },
  { key: 'shotsPer60', label: 'Shots/60' },
  { key: 'shootingPct', label: 'Shooting %' },
  { key: 'ppPointsPerGame', label: 'PP points/GP' },
  { key: 'toiPerGame', label: 'Ice time' },
  { key: 'hitsPer60', label: 'Hits/60' },
  { key: 'blocksPer60', label: 'Blocks/60' },
];

interface Row { label: string; title?: string; get: (p: Skater) => number | null; fmt: (v: number | null) => string; lowBetter?: boolean; noBest?: boolean }
const ROWS: Row[] = [
  { label: 'Games played', get: (p) => p.gp, fmt: (v) => String(v ?? '–'), noBest: true },
  { label: 'Goals', get: (p) => p.goals, fmt: (v) => String(v ?? '–') },
  { label: 'Assists', get: (p) => p.assists, fmt: (v) => String(v ?? '–') },
  { label: 'Points', get: (p) => p.points, fmt: (v) => String(v ?? '–') },
  { label: 'Points per game', get: (p) => p.pointsPerGame, fmt: (v) => fmtDec(v) },
  { label: 'Points per 60', title: 'Points per 60 minutes of ice time', get: (p) => per60(p, p.points), fmt: (v) => fmtDec(v) },
  { label: 'Power-play points', get: (p) => p.ppPoints, fmt: (v) => String(v ?? '–') },
  { label: 'Shots on goal', get: (p) => p.shots, fmt: (v) => String(v ?? '–') },
  { label: 'Shooting %', get: (p) => p.shootingPct, fmt: (v) => fmtPct(v) },
  { label: 'Ice time per game', get: (p) => p.toiPerGame, fmt: (v) => fmtToi(v) },
  { label: 'Plus/minus', get: (p) => p.plusMinus, fmt: (v) => fmtSigned(v) },
  { label: 'Game-winning goals', get: (p) => p.gwg, fmt: (v) => String(v ?? '–') },
  { label: 'Hits', get: (p) => p.hits, fmt: (v) => String(v ?? '–') },
  { label: 'Blocked shots', get: (p) => p.blocks, fmt: (v) => String(v ?? '–') },
  { label: 'Takeaways', get: (p) => p.takeaways, fmt: (v) => String(v ?? '–') },
  { label: 'Faceoff %', get: (p) => p.faceoffPct, fmt: (v) => fmtPct(v) },
];

type Metric = 'points' | 'goals' | 'assists' | 'shots';

function TrendChart({ names, logs, metric }: { names: string[]; logs: (GameLogEntry[] | undefined)[]; metric: Metric }) {
  const option = useMemo<EChartsOption>(() => {
    const lines = logs.map((l) => {
      let t = 0;
      return chronological(l ?? []).map((g, i) => [i + 1, (t += g[metric] ?? 0)]);
    });
    const maxN = Math.max(10, ...lines.map((l) => l.length));
    return {
      grid: { left: 8, right: 40, top: 36, bottom: 30, containLabel: true },
      legend: { top: 0, left: 0, data: names },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const arr = ps as { seriesName: string; value: number[]; color: string }[];
          if (!arr.length) return '';
          return tipHead(`After game ${arr[0].value[0]}`) + arr.map((p) => tipRow(p.seriesName, String(p.value[1]))).join('') + tipEnd;
        },
      },
      xAxis: { type: 'value', min: 1, max: maxN, minInterval: 1, name: 'Game number', nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', minInterval: 1 },
      series: lines.map((data, i) => ({
        name: names[i],
        type: 'line',
        data,
        symbol: 'none',
        lineStyle: { color: SLOT_HEX[i], width: 2.5 },
        itemStyle: { color: SLOT_HEX[i] },
        endLabel: { show: true, color: C.ink1, fontWeight: 600, formatter: (p: unknown) => String((p as { value: number[] }).value[1]) },
      })),
    };
  }, [names, logs, metric]);
  return <EChart option={option} height={320} ariaLabel={`Running ${metric} by game number for each player`} />;
}

export function ComparePlayers({ ids, onChange }: { ids: number[]; onChange: (ids: number[]) => void }) {
  const { season, link } = useSeason();
  const [metric, setMetric] = useState<Metric>('points');
  const skaters = useApi<SkatersResponse>(`/api/skaters?season=${season}&limit=2000`);
  const pctAll = useApi<PercentilesTable>(`/api/percentiles?season=${season}`);
  const logs = useApiMany<{ games: GameLogEntry[] }>(ids.map((id) => `/api/player/${id}/gamelog?season=${season}`));

  const all = skaters.data?.players ?? [];
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const pct = useMemo(() => percentileMap(pctAll.data, season), [pctAll.data, season]);
  const chosen = ids.map((id) => byId.get(id));
  const names = ids.map((id, i) => chosen[i]?.name ?? `Player ${id}`);

  const top3 = useMemo(() => [...all].sort((a, b) => b.points - a.points).slice(0, 3).map((p) => p.id), [all]);
  const groups = new Set(ids.map((id) => pct.get(id)?.group).filter(Boolean));

  if (skaters.error) return <ErrorNotice error={skaters.error} onRetry={skaters.retry} />;

  return (
    <>
      <div className="cmp-bar">
        {skaters.data
          ? <PlayerPicker all={all} selected={ids} onAdd={(id) => onChange([...ids, id])} onRemove={(id) => onChange(ids.filter((x) => x !== id))} />
          : <Skeleton height={44} />}
      </div>

      {ids.length === 0 && (
        <div className="cmp-empty">
          <p>Search for a player above, or start with the league's top three scorers.</p>
          {top3.length === 3 && <button type="button" className="btn btn-primary" onClick={() => onChange(top3)}>Compare the top three scorers</button>}
        </div>
      )}

      {ids.length > 0 && (
        <>
          <div className="cmp-cards" style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 340px))` }}>
            {ids.map((id, i) => (
              <div key={`card-${id}`} className="cmp-card-slot" style={{ '--slot': SLOT_COLORS[i] } as CSSProperties}>
                <PlayerCardLoader id={id} season={season} pct={pct.get(id)} />
              </div>
            ))}
          </div>

          <div className="grid-2 cmp-grid">
            <Panel
              title="Percentile profile"
              sub={groups.size > 1
                ? 'Each player is ranked within his own position group (forwards or defense), so shapes compare standing, not raw numbers.'
                : 'Percentile ranks against the same position group. The brighter ring is the median (50).'}
            >
              {pctAll.data ? (
                <Radar
                  axes={RADAR.map((r) => r.label)}
                  series={ids.map((id, i) => {
                    const p = pct.get(id);
                    return {
                      name: names[i],
                      color: SLOT_HEX[i],
                      values: RADAR.map((r) => (p?.eligible ? p.pct[r.key] : null)),
                      detail: RADAR.map((r) => fmtMetric(r.key, p?.values[r.key])),
                    };
                  })}
                  ariaLabel="Radar chart of percentile ranks for the selected players"
                />
              ) : <Skeleton height={420} />}
              {ids.some((id) => pct.get(id) && !pct.get(id)!.eligible) && (
                <p className="table-note">Players below the minimum games played aren't ranked yet and sit at the center.</p>
              )}
            </Panel>

            <Panel
              title="Running totals"
              sub="By game number, so players are compared at the same point in their seasons"
              tools={<Segmented label="Stat" value={metric} onChange={setMetric}
                options={[{ value: 'points', label: 'Points' }, { value: 'goals', label: 'Goals' }, { value: 'assists', label: 'Assists' }, { value: 'shots', label: 'Shots' }]} />}
            >
              {logs.loading && !logs.data.some(Boolean) ? <Skeleton height={320} />
                : <TrendChart names={names} logs={logs.data.map((d) => d?.games)} metric={metric} />}
            </Panel>
          </div>

          <Panel title="Head to head" sub="This season. ▲ marks the leader in each row." className="cmp-table-panel">
            <div className="table-scroll">
              <table className="table cmp-table">
                <thead>
                  <tr>
                    <th scope="col">Stat</th>
                    {ids.map((id, i) => (
                      <th key={id} scope="col" style={{ '--slot': SLOT_COLORS[i] } as CSSProperties}>
                        <span className="cmp-th"><i aria-hidden />{chosen[i] ? <Link to={link(`/players/${id}`)}>{chosen[i]!.name}</Link> : names[i]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    const vals = chosen.map((p) => (p ? r.get(p) : null));
                    const nums = vals.filter((v): v is number => v != null);
                    const best = !r.noBest && nums.length > 1 ? (r.lowBetter ? Math.min(...nums) : Math.max(...nums)) : null;
                    const unique = best != null && nums.filter((v) => v === best).length === 1;
                    return (
                      <tr key={r.label}>
                        <th scope="row" title={r.title}>{r.label}</th>
                        {vals.map((v, i) => (
                          <td key={i} className={unique && v === best ? 'cmp-best' : undefined}>
                            {r.fmt(v)}{unique && v === best && <span className="cmp-mark" aria-label="leader"> ▲</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
