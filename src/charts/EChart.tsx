import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { broadcastTheme } from './theme';

echarts.registerTheme('broadcast', broadcastTheme);

/**
 * Thin React wrapper around ECharts: creates the chart once, applies option
 * changes, resizes with its container, and disposes on unmount.
 */
export function EChart({ option, height = 360, ariaLabel, onReady }: {
  option: EChartsOption;
  height?: number;
  ariaLabel: string;
  onReady?: (chart: ECharts) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, 'broadcast', { renderer: 'canvas' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    onReady?.(c);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    chart.current?.setOption({ animation: !reduce, ...option }, { notMerge: true });
  }, [option]);

  return <div ref={el} className="chart" style={{ height }} role="img" aria-label={ariaLabel} />;
}
