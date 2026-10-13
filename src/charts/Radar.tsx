import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import { C, FONT_BODY, tipEnd, tipHead, tipRow } from './theme';

export interface RadarSeries {
  name: string;
  color: string;
  values: (number | null)[];   // 0-100 per axis
  detail?: string[];           // optional raw value per axis for the tooltip
}

/**
 * Percentile radar, 0 at the center and 100 at the rim, with a brighter ring at 50 (the
 * median). Up to three overlaid shapes, each with a thin outline and a faint fill so
 * overlaps stay readable. Missing values sit at the center and show as "–".
 */
export function Radar({ axes, series, height = 420, ariaLabel }: {
  axes: string[];
  series: RadarSeries[];
  height?: number;
  ariaLabel: string;
}) {
  const option = useMemo<EChartsOption>(() => ({
    legend: { top: 0, left: 0, data: series.map((s) => s.name) },
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const { name } = p as { name: string };
        const s = series.find((x) => x.name === name);
        if (!s) return '';
        return tipHead(s.name, s.color)
          + axes.map((a, i) => tipRow(a, s.values[i] == null ? '–' : `${Math.round(s.values[i]!)}${s.detail?.[i] ? `  (${s.detail[i]})` : ''}`)).join('')
          + tipEnd;
      },
    },
    radar: {
      center: ['50%', '55%'],
      radius: '68%',
      indicator: axes.map((name) => ({ name, max: 100, min: 0 })),
      splitNumber: 4,
      shape: 'polygon',
      axisName: { color: C.ink2, fontFamily: FONT_BODY, fontSize: 12 },
      // Rings at 25, 50, 75, 100 (inner to outer); the 50 ring (the median) is drawn brighter.
      splitLine: { lineStyle: { color: [C.grid, 'rgba(168,184,207,0.45)', C.grid, C.grid] } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: C.grid } },
    },
    series: [{
      type: 'radar',
      symbol: 'circle',
      symbolSize: 5,
      data: series.map((s) => ({
        name: s.name,
        value: s.values.map((v) => v ?? 0),
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        areaStyle: { color: s.color, opacity: 0.12 },
        emphasis: { areaStyle: { opacity: 0.28 }, lineStyle: { width: 3 } },
      })),
    }],
  }), [axes, series]);

  return <EChart option={option} height={height} ariaLabel={ariaLabel} />;
}
