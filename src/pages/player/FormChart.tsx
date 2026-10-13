import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { Panel } from '../../components/Panel';
import { chronological } from '../../lib/cards';
import { fmtSv } from '../../lib/format';
import type { GameLogEntry } from '../../lib/types';

const WINDOW = 5;
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function rolling(values: (number | null)[], w: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < w - 1) return null;
    const win = values.slice(i - w + 1, i + 1).filter((v): v is number => v != null);
    return win.length ? Math.round((win.reduce((a, v) => a + v, 0) / win.length) * 100) / 100 : null;
  });
}

/**
 * Game-by-game form. Skaters: points per game as bars with a 5-game rolling average.
 * Goalies: save % per game with a 5-game rolling average. Both series share one axis.
 */
export function FormChart({ games, goalie }: { games: GameLogEntry[]; goalie: boolean }) {
  const option = useMemo<EChartsOption>(() => {
    const g = chronological(games);
    const cats = g.map((x) => `${shortDate(x.date)} ${x.homeRoad === 'H' ? 'vs' : '@'} ${x.opp}`);
    const per = g.map((x) => (goalie ? x.savePct : x.points));
    const avg = rolling(per, WINDOW);
    const perName = goalie ? 'Save % that game' : 'Points that game';
    const avgName = `${WINDOW}-game average`;

    return {
      grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, data: [perName, avgName] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(168,184,207,0.06)' } },
        formatter: (ps: unknown) => {
          const arr = ps as { dataIndex: number }[];
          const i = arr[0]?.dataIndex ?? 0;
          const x = g[i];
          let html = tipHead(cats[i]);
          if (goalie) {
            html += tipRow('Save %', fmtSv(x.savePct)) + tipRow('Shots against', String(x.shotsAgainst ?? '–'))
              + tipRow('Goals against', String(x.goalsAgainst ?? '–'));
          } else {
            html += tipRow('Goals', String(x.goals)) + tipRow('Assists', String(x.assists))
              + tipRow('Shots', String(x.shots)) + tipRow('Time on ice', x.toi);
          }
          if (avg[i] != null) html += tipRow(avgName, goalie ? fmtSv(avg[i]) : avg[i]!.toFixed(2));
          return html + tipEnd;
        },
      },
      xAxis: {
        type: 'category',
        data: cats,
        axisLabel: { formatter: (v: string) => v.split(' ').slice(0, 2).join(' '), hideOverlap: true },
      },
      yAxis: goalie
        ? { type: 'value', min: (v: { min: number }) => Math.max(0.7, Math.floor(v.min * 50) / 50), max: 1, axisLabel: { formatter: (v: number) => fmtSv(v) } }
        : { type: 'value', minInterval: 1 },
      series: [
        goalie
          ? { name: perName, type: 'scatter', data: per, symbolSize: 7, itemStyle: { color: C.series[0] } }
          : { name: perName, type: 'bar', data: per, barMaxWidth: 14, itemStyle: { color: C.series[0], borderRadius: [3, 3, 0, 0] } },
        { name: avgName, type: 'line', data: avg, connectNulls: false, lineStyle: { color: C.series[1], width: 2 }, itemStyle: { color: C.series[1] }, symbol: 'none' },
      ],
    };
  }, [games, goalie]);

  return (
    <Panel title="Game-by-game form" sub={goalie ? 'Save percentage each game' : 'Points each game, with the recent trend'}>
      {games.length === 0
        ? <p className="empty">No games played this season yet.</p>
        : <EChart option={option} height={280} ariaLabel="Game-by-game form chart" />}
    </Panel>
  );
}
