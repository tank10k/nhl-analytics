import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, FONT_DISPLAY, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { darkLogo, teamAccent } from '../../lib/teams';
import { fmtDec, fmtSigned, recordStr } from '../../lib/format';
import { useSeason } from '../../lib/season';
import type { Team } from '../../lib/types';

/**
 * Team strength map: goals scored vs goals allowed per game, with the league
 * average splitting the field into four quadrants. The y-axis is inverted so
 * "better" is always up and to the right.
 */
function useNarrow(query = '(max-width: 700px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

/** Round the data range out to tidy tick steps (0.25 or 0.5 goals). */
function niceRange(values: number[]): { min: number; max: number; interval: number } {
  if (!values.length) return { min: 2, max: 4, interval: 0.5 };
  const lo = Math.min(...values), hi = Math.max(...values);
  const interval = hi - lo > 1.6 ? 0.5 : 0.25;
  const pad = interval * 0.4;
  return {
    min: Math.floor((lo - pad) / interval) * interval,
    max: Math.ceil((hi + pad) / interval) * interval,
    interval,
  };
}

export function StrengthQuadrant({ teams }: { teams: Team[] }) {
  const navigate = useNavigate();
  const { link } = useSeason();
  const narrow = useNarrow();

  const option = useMemo<EChartsOption>(() => {
    const played = teams.filter((t) => t.gp > 0);
    const pts = played.map((t) => ({
      t,
      x: t.gf / t.gp,
      y: t.ga / t.gp,
    }));
    const avgX = pts.reduce((s, p) => s + p.x, 0) / (pts.length || 1);
    const avgY = pts.reduce((s, p) => s + p.y, 0) / (pts.length || 1);

    const xr = niceRange(pts.map((p) => p.x));
    const yr = niceRange(pts.map((p) => p.y));

    const data = pts.map(({ t, x, y }) => ({
      value: [x, y],
      name: t.abbrev,
      team: t,
    }));

    const tooltip = (p: unknown) => {
      const t = (p as { data: { team: Team } }).data.team;
      return tipHead(t.name, teamAccent(t.abbrev))
        + tipRow('Goals for per game', fmtDec(t.gf / t.gp))
        + tipRow('Goals against per game', fmtDec(t.ga / t.gp))
        + tipRow('Goal differential', fmtSigned(t.goalDiff))
        + tipRow('Record', recordStr(t.wins, t.losses, t.otLosses))
        + tipRow('Points', String(t.points))
        + tipEnd;
    };

    const corner = (text: string, pos: Record<string, number>) => ({
      type: 'text' as const,
      ...pos,
      silent: true,
      style: { text, fill: C.ink3, font: `600 14px ${FONT_DISPLAY}`, opacity: 0.85 },
    });

    return {
      grid: { left: 12, right: 24, top: 40, bottom: 14, containLabel: true },
      tooltip: { trigger: 'item', formatter: tooltip },
      xAxis: {
        type: 'value',
        min: xr.min,
        max: xr.max,
        interval: xr.interval,
        name: 'Goals scored per game →',
        nameLocation: 'end',
        nameGap: 8,
        nameTextStyle: { color: C.ink2, align: 'right', verticalAlign: 'top', padding: [22, 0, 0, 0] },
        axisLabel: { formatter: (v: number) => v.toFixed(2) },
        splitLine: { lineStyle: { color: C.grid } },
      },
      yAxis: {
        type: 'value',
        inverse: true,
        min: yr.min,
        max: yr.max,
        interval: yr.interval,
        name: '↑ Fewer goals allowed per game',
        nameLocation: 'start',
        nameGap: 16,
        nameTextStyle: { color: C.ink2, align: 'left', padding: [0, 0, 0, -30] },
        axisLabel: { formatter: (v: number) => v.toFixed(2) },
      },
      graphic: narrow ? [] : [
        corner('Strong at both ends', { right: 30, top: 52 }),
        corner('Win by defending', { left: 64, top: 52 }),
        corner('Outscore their problems', { right: 30, bottom: 44 }),
        corner('Struggling at both ends', { left: 64, bottom: 44 }),
      ],
      series: [
        {
          // Team-colored dot under each logo; it is what remains visible if logos fail to load.
          type: 'scatter',
          data: data.map((d) => ({ ...d, itemStyle: { color: teamAccent(d.name) } })),
          symbolSize: 12,
          itemStyle: { borderColor: C.surface, borderWidth: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: C.ink3, type: [4, 4], width: 1 },
            label: {
              color: C.ink3,
              fontSize: 11,
              formatter: (p: unknown) => `League avg ${fmtDec((p as { value: number }).value)}`,
            },
            data: [
              // y is inverted, so the vertical line's "start" is the top edge
              { xAxis: avgX, label: { position: 'start' } },
              { yAxis: avgY, label: { position: 'insideEndTop' } },
            ],
          },
          z: 2,
        },
        {
          type: 'scatter',
          data: data.map((d) => ({ ...d, symbol: `image://${darkLogo(d.team.logo) ?? ''}` })),
          symbolSize: narrow ? 26 : 34,
          emphasis: { scale: 1.25 },
          z: 3,
          cursor: 'pointer',
        },
      ],
    };
  }, [teams, narrow]);

  return (
    <EChart
      option={option}
      height={440}
      ariaLabel="Scatter chart of every team's goals scored per game against goals allowed per game"
      onReady={(c) => c.on('click', (p) => {
        const abbrev = (p.data as { name?: string } | undefined)?.name;
        if (abbrev) navigate(link(`/teams/${abbrev}`));
      })}
    />
  );
}
