// Offensive half of an NHL rink, drawn to scale in feet (SVG user units = feet).
// x runs from center ice (0) to the end boards (100); y from -42.5 to 42.5.
// The attacking net sits at x = 89, matching how the server normalizes shots.

export const RINK = {
  xMin: 0,
  xMax: 100,
  yMin: -42.5,
  yMax: 42.5,
  goalX: 89,
  blueX: 25,
  cornerR: 28,
};

/** y extent of the ice at a given x (the corners are rounded). */
function halfWidthAt(x: number) {
  const cx = RINK.xMax - RINK.cornerR;
  if (x <= cx) return RINK.yMax;
  const dx = x - cx;
  return RINK.yMax - RINK.cornerR + Math.sqrt(RINK.cornerR ** 2 - dx ** 2);
}

export const BOARDS_PATH = (() => {
  const { xMin, xMax, yMin, yMax, cornerR: r } = RINK;
  return `M${xMin},${yMin} L${xMax - r},${yMin} A${r},${r} 0 0 1 ${xMax},${yMin + r} `
    + `L${xMax},${yMax - r} A${r},${r} 0 0 1 ${xMax - r},${yMax} L${xMin},${yMax} Z`;
})();

/** Rink markings. Rendered under the shots; `id` scopes the clip path. */
export function RinkMarkings({ id }: { id: string }) {
  const gy = halfWidthAt(RINK.goalX);
  const faceoffs: [number, number][] = [[69, -22], [69, 22]];
  const neutralDots: [number, number][] = [[20, -22], [20, 22]];
  return (
    <g className="rink">
      <defs>
        <clipPath id={`clip-${id}`}><path d={BOARDS_PATH} /></clipPath>
      </defs>
      <path d={BOARDS_PATH} className="rink-ice" />
      <g clipPath={`url(#clip-${id})`}>
        {/* center red line (half of it shows) and center circle */}
        <line x1={0} y1={RINK.yMin} x2={0} y2={RINK.yMax} className="rink-red" strokeWidth={1} />
        <circle cx={0} cy={0} r={15} className="rink-line-blue-thin" />
        <line x1={RINK.blueX} y1={RINK.yMin} x2={RINK.blueX} y2={RINK.yMax} className="rink-blue" strokeWidth={1} />
        {neutralDots.map(([x, y]) => <circle key={`n${y}`} cx={x} cy={y} r={1} className="rink-dot" />)}
        {faceoffs.map(([x, y]) => (
          <g key={`f${y}`}>
            <circle cx={x} cy={y} r={15} className="rink-circle" />
            <circle cx={x} cy={y} r={1} className="rink-dot" />
          </g>
        ))}
        <line x1={RINK.goalX} y1={-gy} x2={RINK.goalX} y2={gy} className="rink-red" strokeWidth={0.35} />
        {/* goal crease and net */}
        <path d={`M${RINK.goalX},-4 L${RINK.goalX - 4.5},-4 A6,6 0 0 0 ${RINK.goalX - 4.5},4 L${RINK.goalX},4 Z`} className="rink-crease" />
        <rect x={RINK.goalX} y={-3} width={3.3} height={6} rx={0.8} className="rink-net" />
      </g>
      <path d={BOARDS_PATH} className="rink-boards" />
    </g>
  );
}
