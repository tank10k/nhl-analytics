// ECharts "broadcast" theme: matches the CSS tokens in styles/global.css.
// Every chart in the app is drawn with this theme, so grid, axes, tooltips and
// fonts stay consistent without per-chart styling.

export const C = {
  surface: '#101d33',
  ink1: '#eaf1fa',
  ink2: '#a8b8cf',
  ink3: '#7d91ae',
  grid: 'rgba(168, 184, 207, 0.10)',
  axis: 'rgba(168, 184, 207, 0.28)',
  blueLine: '#4da3ff',
  series: ['#3987e5', '#d95926', '#199e70'], // validated dark steps; max 3 series per chart
  pos: '#3987e5',
  neg: '#e66767',
};

export const FONT_BODY = "Barlow, system-ui, sans-serif";
export const FONT_DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";

export const broadcastTheme = {
  color: C.series,
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT_BODY, color: C.ink2 },
  grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
  categoryAxis: {
    axisLine: { show: true, lineStyle: { color: C.axis } },
    axisTick: { show: false },
    axisLabel: { color: C.ink3, fontSize: 12 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: C.ink3, fontSize: 12 },
    splitLine: { show: true, lineStyle: { color: C.grid } },
    nameTextStyle: { color: C.ink2, fontFamily: FONT_BODY, fontSize: 12 },
  },
  line: { symbol: 'none', lineStyle: { width: 2 }, smooth: false },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
  tooltip: {
    backgroundColor: '#162741',
    borderColor: '#24395b',
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: C.ink1, fontFamily: FONT_BODY, fontSize: 13 },
    extraCssText: 'border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.45);',
  },
  legend: { textStyle: { color: C.ink2 }, icon: 'roundRect', itemWidth: 12, itemHeight: 4 },
};

/** Tooltip HTML helpers: values are rendered as text in ink colors, color only on the swatch. */
export function tipHead(title: string, swatch?: string): string {
  const sw = swatch ? `<span class="swatch" style="background:${swatch}"></span>` : '';
  return `<div class="viz-tip"><div class="tip-head">${sw}${escapeHtml(title)}</div>`;
}
export function tipRow(label: string, value: string): string {
  return `<div class="tip-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}
export const tipEnd = '</div>';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
