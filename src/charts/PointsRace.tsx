import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import { C, tipEnd, tipHead, tipRow } from './theme';
import { teamAccent } from '../lib/teams';
import { useSeason } from '../lib/season';
import type { RaceTeam } from '../lib/types';

/**
 * Points cut line by game number: the 8th-best running total among a conference's
 * teams after n games. That's where the last playoff spot sits at each point of the season.
 */
export function playoffLine(teams: RaceTeam[]): [number, number][] {
  const maxN = Math.max(0, ...teams.map((t) => t.games.length));
  const out: [number, number][] = [];
  for (let n = 1; n <= maxN; n++) {
    const pts = teams
      .map((t) => t.games[n - 1]?.points)
      .filter((v): v is number => v != null)
      .sort((a, b) => b - a);
    if (pts.length >= 8) out.push([n, pts[7]]);
  }
  return out;
}

/**
 * Running points by game number. Each team's line is in its own color and labelled at
 * its end, so identity never rests on color alone. With `focus`, that team is drawn bold
 * and the rest recede to thin gray context lines.
 */
export function PointsRace({ teams, cutTeams, focus, height = 420 }: {
  teams: RaceTeam[];       // lines to draw
  cutTeams?: RaceTeam[];   // conference used for the playoff line (omit to hide it)
  focus?: string;          // team to emphasize
  height?: number;
}) {
  const navigate = useNavigate();
  const { link } = useSeason();

  const option = useMemo<EChartsOption>(() => {
    const cut = cutTeams ? playoffLine(cutTeams) : [];
    const maxN = Math.max(10, ...teams.map((t) => t.games.length));
    const ordered = [...teams].sort((a, b) => (a.abbrev === focus ? 1 : b.abbrev === focus ? -1 : 0)); // focus drawn last (on top)

    const series: NonNullable<EChartsOption['series']> = ordered.map((t) => {
      const isFocus = t.abbrev === focus;
      const muted = Boolean(focus) && !isFocus;
      const color = muted ? 'rgba(168,184,207,0.35)' : teamAccent(t.abbrev);
      return {
        name: t.abbrev,
        type: 'line',
        data: t.games.map((g) => [g.n, g.points]),
        symbol: 'none',
        lineStyle: { color, width: isFocus ? 3.5 : muted ? 1.25 : 2 },
        itemStyle: { color },
        emphasis: { focus: 'series', lineStyle: { width: 3.5 } },
        endLabel: {
          show: true,
          formatter: t.abbrev,
          color: muted ? C.ink3 : C.ink1,
          fontWeight: isFocus || !focus ? 700 : 500,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: isFocus ? 15 : 13,
          distance: 6,
        },
        z: isFocus ? 5 : 2,
        cursor: 'pointer',
      };
    });

    if (cut.length) {
      series.push({
        name: 'Playoff line',
        type: 'line',
        data: cut,
        symbol: 'none',
        lineStyle: { color: C.ink2, width: 1.5, type: [6, 5] },
        itemStyle: { color: C.ink2 },
        endLabel: { show: true, formatter: 'Playoff line', color: C.ink2, fontSize: 12, distance: 6 },
        z: 1,
        silent: true,
      });
    }

    return {
      grid: { left: 8, right: 86, top: 16, bottom: 30, containLabel: true },
      labelLayout: { moveOverlap: 'shiftY' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: C.axis } },
        formatter: (ps: unknown) => {
          const arr = (ps as { seriesName: string; value: [number, number] }[])
            .filter((p) => p.value)
            .sort((a, b) => b.value[1] - a.value[1]);
          if (!arr.length) return '';
          let h = tipHead(`After game ${arr[0].value[0]}`);
          for (const p of arr) {
            if (focus && p.seriesName !== focus && p.seriesName !== 'Playoff line') continue;
            h += tipRow(p.seriesName === 'Playoff line' ? 'Playoff line (8th in conference)' : p.seriesName, `${p.value[1]} pts`);
          }
          if (focus) {
            const others = arr.filter((p) => p.seriesName !== focus && p.seriesName !== 'Playoff line');
            if (others.length) h += tipRow('Division leader', `${others[0].seriesName} ${others[0].value[1]} pts`);
          }
          return h + tipEnd;
        },
      },
      xAxis: { type: 'value', min: 1, max: maxN, minInterval: 1, name: 'Game number', nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', minInterval: 1, name: 'Points', nameTextStyle: { color: C.ink2, align: 'left', padding: [0, 0, 0, -20] } },
      series,
    };
  }, [teams, cutTeams, focus]);

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel="Line chart of running points total by game number"
      onReady={(c) => c.on('click', (p) => {
        const name = (p as { seriesName?: string }).seriesName;
        if (name && /^[A-Z]{3}$/.test(name)) navigate(link(`/teams/${name}`));
      })}
    />
  );
}
