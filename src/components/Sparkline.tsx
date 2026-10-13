// Tiny inline chart for cards and tables. Bars suit small whole numbers (points per
// game); a line suits rates (save % per game). No axes: the caption carries the numbers.

export function Sparkline({ values, color, kind = 'bar', width = 120, height = 28, label }: {
  values: (number | null)[];
  color: string;
  kind?: 'bar' | 'line';
  width?: number;
  height?: number;
  label: string;
}) {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(1, ...nums);
  const min = kind === 'line' ? Math.min(...nums) : 0;
  const span = max - min || 1;
  const n = values.length || 1;

  if (kind === 'line') {
    const pts = nums.map((v, i) => `${((i + 0.5) / n) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(' ');
    return (
      <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }

  const gap = 2;
  const bw = Math.max(2, width / n - gap);
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {nums.map((v, i) => {
        const h = v > 0 ? Math.max(3, (v / max) * (height - 2)) : 2;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={height - h}
            width={bw}
            height={h}
            rx={v > 0 ? 1.5 : 1}
            fill={v > 0 ? color : 'rgba(168,184,207,0.25)'}
          />
        );
      })}
    </svg>
  );
}
