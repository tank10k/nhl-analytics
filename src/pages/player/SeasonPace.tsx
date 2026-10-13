import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { Panel, Segmented, Skeleton } from '../../components/Panel';
import { useApi } from '../../lib/api';
import { chronological } from '../../lib/cards';
import { seasonLabel } from '../../lib/format';
import type { GameLogEntry } from '../../lib/types';

type Metric = 'points' | 'goals' | 'assists' | 'shots';
const METRICS: { value: Metric; label: string }[] = [
  { value: 'points', label: 'Points' },
  { value: 'goals', label: 'Goals' },
  { value: 'assists', label: 'Assists' },
  { value: 'shots', label: 'Shots' },
];

function running(games: GameLogEntry[], key: Metric): number[] {
  let t = 0;
  return chronological(games).map((g) => (t += g[key] ?? 0));
}

/**
 * Running total by game number for the selected season, with an earlier season dashed
 * underneath. Game number (not date) on the x-axis compares the two at the same pace.
 */
export function SeasonPace({ playerId, season, games, pastSeasons }: {
  playerId: number;
  season: string;
  games: GameLogEntry[];
  pastSeasons: string[];
}) {
  const [metric, setMetric] = useState<Metric>('points');
  const [compare, setCompare] = useState<string>(pastSeasons[0] ?? '');
  const other = useApi<{ games: GameLogEntry[] }>(compare ? `/api/player/${playerId}/gamelog?season=${compare}` : null);

  const option = useMemo<EChartsOption>(() => {
    const cur = running(games, metric);
    const prev = compare && other.data ? running(other.data.games, metric) : [];
    const n = Math.max(cur.length, prev.length, 10);
    const label = METRICS.find((m) => m.value === metric)!.label.toLowerCase();
    const curName = seasonLabel(season);
    const prevName = compare ? seasonLabel(compare) : '';

    const series: NonNullable<EChartsOption['series']> = [];
    if (prev.length) {
      series.push({
        name: prevName,
        type: 'line',
        data: prev.map((v, i) => [i + 1, v]),
        lineStyle: { color: C.ink3, width: 2, type: [6, 4] },
        itemStyle: { color: C.ink3 },
        symbol: 'none',
        z: 1,
      });
    }
    series.push({
      name: curName,
      type: 'line',
      data: cur.map((v, i) => [i + 1, v]),
      lineStyle: { color: C.series[0], width: 2.5 },
      itemStyle: { color: C.series[0] },
      symbol: 'none',
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: 'rgba(57,135,229,0.22)' }, { offset: 1, color: 'rgba(57,135,229,0)' },
      ] } },
      endLabel: { show: true, color: C.ink1, fontWeight: 600, formatter: (p: unknown) => String((p as { value: number[] }).value[1]) },
      z: 2,
    });

    return {
      grid: { left: 8, right: 36, top: 36, bottom: 30, containLabel: true },
      legend: { top: 0, left: 0, data: prev.length ? [curName, prevName] : [curName] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: C.axis } },
        formatter: (ps: unknown) => {
          const arr = ps as { seriesName: string; value: number[]; color: string }[];
          if (!arr.length) return '';
          let html = tipHead(`Game ${arr[0].value[0]}`);
          for (const p of [...arr].reverse()) html += tipRow(p.seriesName, `${p.value[1]} ${label}`);
          return html + tipEnd;
        },
      },
      xAxis: { type: 'value', min: 1, max: n, name: 'Game number', nameLocation: 'middle', nameGap: 26, minInterval: 1 },
      yAxis: { type: 'value', minInterval: 1 },
      series,
    };
  }, [games, other.data, metric, compare, season]);

  return (
    <Panel
      title="Season pace"
      sub="Running total by game number, so seasons compare at the same point"
      tools={
        <>
          <Segmented label="Pace stat" value={metric} options={METRICS} onChange={setMetric} />
          {pastSeasons.length > 0 && (
            <label className="field">
              <span className="sr-only">Compare with season</span>
              <select className="select select-sm" value={compare} onChange={(e) => setCompare(e.target.value)}>
                <option value="">No comparison</option>
                {pastSeasons.map((s) => <option key={s} value={s}>vs {seasonLabel(s)}</option>)}
              </select>
            </label>
          )}
        </>
      }
    >
      {games.length === 0
        ? <p className="empty">No games played this season yet.</p>
        : other.loading && compare ? <Skeleton height={320} /> : (
          <EChart option={option} height={320} ariaLabel={`Running ${metric} total by game number`} />
        )}
    </Panel>
  );
}
