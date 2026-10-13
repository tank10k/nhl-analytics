import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import { C, tipEnd, tipHead, tipRow } from './theme';
import { teamAccent } from '../lib/teams';
import { useSeason } from '../lib/season';
import { ordinal } from '../lib/format';
import type { RaceTeam } from '../lib/types';

/**
 * Rank in the conference after each game number (1 at the top). Teams are compared at
 * the same number of games played, so games in hand don't distort the order. Ties go to
 * goal differential. Hover a line to isolate one team. Once 20+ games are in, the
 * axis starts at game 5, since the first few games reshuffle ranks on single results.
 */
export function BumpChart({ teams, height = 460 }: { teams: RaceTeam[]; height?: number }) {
  const navigate = useNavigate();
  const { link } = useSeason();

  const option = useMemo<EChartsOption>(() => {
    const maxN = Math.max(0, ...teams.map((t) => t.games.length));
    const ranks = new Map<string, [number, number][]>(teams.map((t) => [t.abbrev, []]));
    const diff = (t: RaceTeam, n: number) => t.games.slice(0, n).reduce((a, g) => a + (g.gf ?? 0) - (g.ga ?? 0), 0);
    for (let n = 1; n <= maxN; n++) {
      const at = teams
        .filter((t) => t.games.length >= n)
        .map((t) => ({ t, pts: t.games[n - 1].points, gd: diff(t, n) }))
        .sort((a, b) => b.pts - a.pts || b.gd - a.gd);
      at.forEach((x, i) => ranks.get(x.t.abbrev)!.push([n, i + 1]));
    }
    const pointsAt = (abbrev: string, n: number) => teams.find((t) => t.abbrev === abbrev)?.games[n - 1]?.points;

    return {
      grid: { left: 8, right: 56, top: 12, bottom: 30, containLabel: true },
      labelLayout: { moveOverlap: 'shiftY' },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const { seriesName, value } = p as { seriesName: string; value: [number, number] };
          return tipHead(seriesName, teamAccent(seriesName))
            + tipRow(`After game ${value[0]}`, `${ordinal(value[1])} in conference`)
            + tipRow('Points', String(pointsAt(seriesName, value[0]) ?? '–'))
            + tipEnd;
        },
      },
      xAxis: { type: 'value', min: maxN >= 20 ? 5 : 1, max: Math.max(maxN, 2), minInterval: 1, name: 'Game number', nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', inverse: true, min: 1, max: Math.max(teams.length, 2), interval: 1,
        axisLabel: { formatter: (v: number) => (v === 1 || v % 4 === 0 || v === 8 ? String(v) : '') },
        splitLine: { show: false } },
      series: teams.map((t) => {
        const color = teamAccent(t.abbrev);
        return {
          name: t.abbrev,
          type: 'line',
          data: ranks.get(t.abbrev),
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: maxN <= 15,
          smooth: 0.25,
          // Lines rest dimmed so the tangle stays readable; hovering one brings it forward.
          lineStyle: { color, width: 1.75, opacity: 0.55 },
          itemStyle: { color, opacity: 0.55 },
          endLabel: { show: true, formatter: t.abbrev, color: C.ink1, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 13, distance: 6 },
          emphasis: { focus: 'series', lineStyle: { width: 4, opacity: 1 }, itemStyle: { opacity: 1 } },
          blur: { lineStyle: { opacity: 0.12 }, itemStyle: { opacity: 0.12 }, endLabel: { opacity: 0.25 } },
          markLine: t === teams[0] ? {
            silent: true, symbol: 'none',
            lineStyle: { color: C.ink3, type: [6, 5], width: 1 },
            label: { formatter: 'Playoff cut', color: C.ink2, position: 'insideStartBottom', fontSize: 11 },
            data: [{ yAxis: 8.5 }],
          } : undefined,
          cursor: 'pointer',
        };
      }),
    };
  }, [teams]);

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel="Bump chart of conference rank by game number"
      onReady={(c) => c.on('click', (p) => {
        const name = (p as { seriesName?: string }).seriesName;
        if (name && /^[A-Z]{3}$/.test(name)) navigate(link(`/teams/${name}`));
      })}
    />
  );
}
