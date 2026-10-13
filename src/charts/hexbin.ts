// Minimal hexagonal binning (pointy-top hexes), enough for shot heat maps.

export interface Hex<T> {
  cx: number;
  cy: number;
  items: T[];
}

export function hexbin<T>(items: T[], x: (d: T) => number, y: (d: T) => number, r: number): Hex<T>[] {
  const dx = r * Math.sqrt(3); // column spacing
  const dy = r * 1.5;          // row spacing
  const bins = new Map<string, Hex<T>>();
  for (const d of items) {
    const px = x(d), py = y(d);
    // candidate row/column, then pick the nearer of the two neighbouring centers
    let row = Math.round(py / dy);
    let col = Math.round(px / dx - (row & 1) / 2);
    const cy1 = row * dy, cx1 = (col + (row & 1) / 2) * dx;
    const row2 = py / dy > row ? row + 1 : row - 1;
    const col2 = Math.round(px / dx - (row2 & 1) / 2);
    const cy2 = row2 * dy, cx2 = (col2 + (row2 & 1) / 2) * dx;
    let cx = cx1, cy = cy1;
    if ((px - cx2) ** 2 + (py - cy2) ** 2 < (px - cx1) ** 2 + (py - cy1) ** 2) {
      row = row2; col = col2; cx = cx2; cy = cy2;
    }
    const key = `${row}:${col}`;
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = { cx, cy, items: [] }));
    bin.items.push(d);
  }
  return [...bins.values()];
}

/** SVG path for a pointy-top hexagon of radius r centred at (0,0). */
export function hexPath(r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
  });
  return `M${pts.join('L')}Z`;
}
