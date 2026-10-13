import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import { C, FONT_DISPLAY, tipEnd, tipHead, tipRow } from './theme';
import { darkLogo, teamAccent } from '../lib/teams';
import { useSeason } from '../lib/season';

export interface LogoPoint {
  abbrev: string;
  name: string;
  logo?: string | null;
  x: number;
  y: number;
  rows: [string, string][]; // tooltip lines
}

/**
 * Teams as logos on a two-measure plane, split into quadrants by reference lines.
 * Each team also gets a dot in its color underneath, which stays visible if a logo fails.
 */
export function LogoScatter({ points, xName, yName, xMid, yMid, xFmt, yFmt, corners, height = 440, ariaLabel }: {
  points: LogoPoint[];
  xName: string;
  yName: string;
  xMid: number;
  yMid: number;
  xFmt: (v: number) => string;
  yFmt: (v: number) => string;
  corners: { tl: string; tr: string; bl: string; br: string };
  height?: number;
  ariaLabel: string;
}) {
  const navigate = useNavigate();
  const { link } = useSeason();

  const option = useMemo<EChartsOption>(() => {
    const span = (vals: number[], mid: number) => {
      const d = Math.max(...vals.map((v) => Math.abs(v - mid)), 1e-6) * 1.15;
      return [mid - d, mid + d]; // symmetric around the reference line so quadrants are comparable
    };
    const [x0, x1] = span(points.map((p) => p.x), xMid);
    const [y0, y1] = span(points.map((p) => p.y), yMid);
    const data = points.map((p) => ({ value: [p.x, p.y], name: p.abbrev, p }));
    const corner = (text: string, pos: Record<string, number>) => ({
      type: 'text' as const, ...pos, silent: true,
      style: { text, fill: C.ink3, font: `600 14px ${FONT_DISPLAY}`, opacity: 0.85 },
    });
    return {
      grid: { left: 12, right: 24, top: 40, bottom: 30, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (x: unknown) => {
          const p = (x as { data: { p: LogoPoint } }).data.p;
          return tipHead(p.name, teamAccent(p.abbrev)) + p.rows.map(([k, v]) => tipRow(k, v)).join('') + tipEnd;
        },
      },
      xAxis: { type: 'value', min: x0, max: x1, axisLabel: { formatter: (v: number) => xFmt(v) },
        name: xName, nameLocation: 'middle', nameGap: 28, splitLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: 'value', min: y0, max: y1, axisLabel: { formatter: (v: number) => yFmt(v) },
        name: yName, nameTextStyle: { color: C.ink2, align: 'left', padding: [0, 0, 0, -30] } },
      graphic: [
        corner(corners.tl, { left: 70, top: 52 }),
        corner(corners.tr, { right: 34, top: 52 }),
        corner(corners.bl, { left: 70, bottom: 64 }),
        corner(corners.br, { right: 34, bottom: 64 }),
      ],
      series: [
        {
          type: 'scatter',
          data: data.map((d) => ({ ...d, itemStyle: { color: teamAccent(d.name) } })),
          symbolSize: 12,
          itemStyle: { borderColor: C.surface, borderWidth: 2 },
          markLine: {
            silent: true, symbol: 'none',
            lineStyle: { color: C.ink3, type: [4, 4], width: 1 },
            label: { show: false },
            data: [{ xAxis: xMid }, { yAxis: yMid }],
          },
          z: 2,
        },
        {
          type: 'scatter',
          data: data.map((d) => ({ ...d, symbol: `image://${darkLogo(d.p.logo) ?? ''}` })),
          symbolSize: 32,
          emphasis: { scale: 1.25 },
          cursor: 'pointer',
          z: 3,
        },
      ],
    };
  }, [points, xName, yName, xMid, yMid, xFmt, yFmt, corners]);

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={ariaLabel}
      onReady={(c) => c.on('click', (p) => {
        const abbrev = (p.data as { name?: string } | undefined)?.name;
        if (abbrev) navigate(link(`/teams/${abbrev}`));
      })}
    />
  );
}
