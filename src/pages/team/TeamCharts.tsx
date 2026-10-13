import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { gameAxisInterval, trailing } from '../../lib/stats';
import type { ScheduleGame } from '../../lib/types';

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const decided = (g: ScheduleGame) => (g.decidedIn === 'OT' ? ' (OT)' : g.decidedIn === 'SO' ? ' (SO)' : '');

/**
 * Every game as a bar for its goal differential: up for wins, down for losses. Games
 * settled in overtime or a shootout are drawn lighter, since they came down to one goal
 * or a skills contest. Hover any bar for the score.
 */
export function ResultsStrip({ games }: { games: ScheduleGame[] }) {
  const empty = !games.some((g) => g.gameNumber);
  const option = useMemo<EChartsOption>(() => {
    const done = games.filter((g) => g.gameNumber && g.gf != null && g.ga != null);
    return {
      grid: { left: 8, right: 12, top: 12, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(168,184,207,0.06)' } },
        formatter: (ps: unknown) => {
          const g = done[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
          const res = g.result === 'W' ? 'Win' : g.result === 'OTL' ? 'Overtime loss' : 'Loss';
          return tipHead(`Game ${g.gameNumber}: ${g.home ? 'vs' : '@'} ${g.opp}`)
            + tipRow('Date', shortDate(g.date))
            + tipRow('Result', `${res}${decided(g)}`)
            + tipRow('Score', `${g.gf}–${g.ga}`)
            + tipRow('Points after', String(g.points))
            + tipEnd;
        },
      },
      xAxis: {
        type: 'category',
        data: done.map((g) => String(g.gameNumber)),
        axisLabel: { interval: gameAxisInterval(done.length) },
        name: 'Game number', nameLocation: 'middle', nameGap: 26,
      },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { formatter: (v: number) => (v > 0 ? `+${v}` : String(v)) } },
      series: [{
        type: 'bar',
        barCategoryGap: '25%',
        barMaxWidth: 22,
        data: done.map((g) => {
          const diff = (g.gf ?? 0) - (g.ga ?? 0);
          const extra = g.decidedIn === 'OT' || g.decidedIn === 'SO';
          return {
            value: diff,
            itemStyle: {
              color: diff > 0 ? C.pos : C.neg,
              opacity: extra ? 0.5 : 1,
              borderRadius: diff > 0 ? [3, 3, 0, 0] : [0, 0, 3, 3],
            },
          };
        }),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: C.ink3, width: 1 }, label: { show: false }, data: [{ yAxis: 0 }] },
      }],
    };
  }, [games]);
  if (empty) return <p className="empty">No games played yet this season.</p>;
  return <EChart option={option} height={220} ariaLabel="Goal differential of every game this season" />;
}

/**
 * Rolling goals for and against per game: the team's recent form. Uses a 10-game window
 * once 20 games are in (5 before that), averaging whatever games exist early on, so the
 * chart has lines from game 1.
 */
export function RollingForm({ games, accent }: { games: ScheduleGame[]; accent: string }) {
  const option = useMemo<EChartsOption>(() => {
    const done = games.filter((g) => g.gameNumber && g.gf != null && g.ga != null);
    const n = done.length;
    const w = n >= 20 ? 10 : 5;
    const gf = trailing(done.map((g) => g.gf), w);
    const ga = trailing(done.map((g) => g.ga), w);
    const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
    const forName = 'Goals for', agName = 'Goals against';
    const few = n <= 15; // with few games, show a dot per game so short lines stay visible
    return {
      grid: { left: 8, right: 12, top: 36, bottom: 28, containLabel: true },
      legend: { top: 0, left: 0, data: [forName, agName] },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
          const from = Math.max(1, i + 2 - w);
          const range = from === i + 1 ? `Game ${i + 1}` : `Games ${from}–${i + 1}`;
          return tipHead(range)
            + tipRow(`${forName} per game`, gf[i] != null ? gf[i]!.toFixed(2) : '–')
            + tipRow(`${agName} per game`, ga[i] != null ? ga[i]!.toFixed(2) : '–')
            + tipEnd;
        },
      },
      xAxis: { type: 'category', data: done.map((g) => String(g.gameNumber)), boundaryGap: few,
        axisLabel: { interval: gameAxisInterval(n) },
        name: `Game number (average of up to ${w} games)`, nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', min: 0, minInterval: 1 },
      series: [
        { name: forName, type: 'line', data: gf.map(r2), symbol: 'circle', showSymbol: few, symbolSize: 7,
          lineStyle: { color: accent, width: 2.5 }, itemStyle: { color: accent } },
        { name: agName, type: 'line', data: ga.map(r2), symbol: 'circle', showSymbol: few, symbolSize: 7,
          lineStyle: { color: C.neg, width: 2, type: [6, 4] }, itemStyle: { color: C.neg } },
      ],
    };
  }, [games, accent]);
  if (!games.some((g) => g.gameNumber)) return <p className="empty">No games played yet this season.</p>;
  return <EChart option={option} height={260} ariaLabel="Rolling goals for and against per game" />;
}
