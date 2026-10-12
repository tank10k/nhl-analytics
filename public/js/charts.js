// Reusable horizontal bar charts drawn as plain SVG (no library).
//   mode 'stacked'   : each row has values{key:number}; segments follow series order
//   mode 'diverging' : each row has value (signed); series[0] = positive color, series[1] = negative
// Rows: { id, label, values | value, valueLabel, tip (html) }

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
};

// ---- tooltip (one shared element) ----
let tipEl;
export const tip = {
  show(html, e) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    this.move(e);
  },
  move(e) {
    if (!tipEl) return;
    const pad = 14, r = tipEl.getBoundingClientRect();
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    tipEl.style.left = `${Math.max(8, x)}px`;
    tipEl.style.top = `${Math.max(8, y)}px`;
  },
  hide() { if (tipEl) tipEl.style.display = 'none'; },
};

// ---- helpers ----
function niceTicks(max, target, integer = false) {
  if (!(max > 0)) return { ticks: [0, 1], max: 1 };
  const raw = max / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  if (integer) step = Math.max(1, Math.round(step));
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 1e6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { ticks, max: top };
}

// Bar with a square baseline end and a 4px rounded data end.
function barPath(x, y, w, h, side) {
  const r = Math.min(4, w, h / 2);
  if (side === 'right') {
    return `M${x} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x}Z`;
  }
  if (side === 'left') {
    return `M${x + r} ${y}H${x + w}V${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
}

// ---- public API ----
export function renderBars(container, opts) {
  container._opts = opts;
  if (!container._built) {
    container.innerHTML = '<div class="legend"></div><div class="plot"></div>';
    container._plot = container.querySelector('.plot');
    let lastW = 0;
    new ResizeObserver(() => {
      const w = container._plot.clientWidth;
      if (w !== lastW) { lastW = w; draw(container); }
    }).observe(container._plot);
    container._built = true;
  }
  // A single series needs no legend (the panel title names it).
  container.querySelector('.legend').innerHTML = opts.series.length < 2 ? '' : opts.series.map((s) =>
    `<span class="key"><i style="background:${s.color}"></i>${s.name}</span>`).join('');
  draw(container);
}

function draw(container) {
  const { rows, series, mode, label, rowH = 22, labelWidth = 44 } = container._opts;
  const plot = container._plot;
  plot.textContent = '';
  if (!rows.length) { plot.innerHTML = '<p class="empty">No data for this selection.</p>'; return; }

  const W = Math.max(plot.clientWidth, 300);
  const m = { top: 26, left: labelWidth, right: 74, bottom: 4 };
  const barH = 14, innerW = W - m.left - m.right, gap = 2;
  const H = m.top + rows.length * rowH + m.bottom;

  let x, ticks;
  if (mode === 'diverging') {
    const nt = niceTicks(Math.max(1, ...rows.map((r) => Math.abs(r.value))), 3);
    x = (v) => m.left + innerW / 2 + (v / nt.max) * (innerW / 2);
    ticks = [...nt.ticks.slice(1).reverse().map((t) => -t), ...nt.ticks];
  } else {
    const total = (r) => series.reduce((a, s) => a + (r.values[s.key] || 0), 0);
    const nt = niceTicks(Math.max(1, ...rows.map(total)), 5);
    x = (v) => m.left + (v / nt.max) * innerW;
    ticks = nt.ticks;
  }

  const root = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label || 'Bar chart' });

  for (const t of ticks) {
    root.append(
      svg('line', { x1: x(t), x2: x(t), y1: m.top - 6, y2: H - m.bottom, class: t === 0 ? 'axis' : 'grid' }),
      svg('text', { x: x(t), y: m.top - 10, 'text-anchor': 'middle', class: 'tick' }, String(t)),
    );
  }

  rows.forEach((r, i) => {
    const y0 = m.top + i * rowH, by = y0 + (rowH - barH) / 2;
    const band = svg('rect', { x: 0, y: y0, width: W, height: rowH, class: 'band' });
    root.append(band, svg('text', { x: m.left - 8, y: y0 + rowH / 2 + 4, 'text-anchor': 'end', class: 'rowlabel' }, r.label));

    if (mode === 'diverging') {
      if (r.value) {
        const pos = r.value > 0, x0 = x(0), x1 = x(r.value);
        root.append(svg('path', {
          d: barPath(Math.min(x0, x1), by, Math.abs(x1 - x0), barH, pos ? 'right' : 'left'),
          fill: pos ? series[0].color : series[1].color,
        }));
      }
    } else {
      let cum = 0;
      const vals = series.map((s) => r.values[s.key] || 0);
      const last = vals.reduce((a, v, k) => (v > 0 ? k : a), -1);
      series.forEach((s, k) => {
        const v = vals[k];
        if (v <= 0) return;
        const xa = x(cum), xb = x(cum + v);
        const w = Math.max(1, xb - xa - (k === last ? 0 : gap)); // 2px surface gap between fills
        root.append(svg('path', { d: barPath(xa, by, w, barH, k === last ? 'right' : 'none'), fill: s.color }));
        cum += v;
      });
    }

    root.append(svg('text', { x: W - m.right + 8, y: y0 + rowH / 2 + 4, class: 'vallabel' }, r.valueLabel ?? ''));

    const hit = svg('rect', { x: 0, y: y0, width: W, height: rowH, fill: 'transparent' });
    hit.addEventListener('pointerenter', (e) => { band.classList.add('on'); tip.show(r.tip, e); });
    hit.addEventListener('pointermove', (e) => tip.move(e));
    hit.addEventListener('pointerleave', () => { band.classList.remove('on'); tip.hide(); });
    root.append(hit);
  });

  plot.append(root);
}

// ---- scatter ----
// opts: { points:[{x,y,label,tip}], xLabel, yLabel, label, labelTop }
// Labels the `labelTop` highest points (skipping ones that would collide); hover shows nearby points.
export function renderScatter(container, opts) {
  container._sopts = opts;
  if (!container._sbuilt) {
    container.innerHTML = '<div class="plot"></div>';
    container._plot = container.firstChild;
    let lastW = 0;
    new ResizeObserver(() => {
      const w = container._plot.clientWidth;
      if (w !== lastW) { lastW = w; drawScatter(container); }
    }).observe(container._plot);
    container._sbuilt = true;
  }
  drawScatter(container);
}

function drawScatter(container) {
  const { points, xLabel, yLabel, label, labelTop = 0 } = container._sopts;
  const plot = container._plot;
  plot.textContent = '';
  if (!points.length) { plot.innerHTML = '<p class="empty">No data for this selection.</p>'; return; }

  const W = Math.max(plot.clientWidth, 300), H = W < 520 ? 300 : 380;
  const m = { top: 12, right: 20, bottom: 44, left: 48 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const xt = niceTicks(Math.max(1, ...points.map((p) => p.x)), 6);
  const yt = niceTicks(Math.max(1, ...points.map((p) => p.y)), 5);
  const X = (v) => m.left + (v / xt.max) * iw;
  const Y = (v) => m.top + ih - (v / yt.max) * ih;

  const root = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label || 'Scatter chart' });
  for (const t of yt.ticks) {
    root.append(
      svg('line', { x1: m.left, x2: W - m.right, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis' : 'grid' }),
      svg('text', { x: m.left - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' }, String(t)),
    );
  }
  for (const t of xt.ticks) {
    root.append(
      svg('line', { x1: X(t), x2: X(t), y1: m.top, y2: m.top + ih, class: t === 0 ? 'axis' : 'grid' }),
      svg('text', { x: X(t), y: m.top + ih + 16, 'text-anchor': 'middle', class: 'tick' }, String(t)),
    );
  }
  root.append(
    svg('text', { x: m.left + iw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axtitle' }, xLabel),
    svg('text', { transform: `translate(12 ${m.top + ih / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'axtitle' }, yLabel),
  );

  const pts = points.map((p) => ({ ...p, cx: X(p.x), cy: Y(p.y) }));
  for (const p of pts) root.append(svg('circle', { cx: p.cx, cy: p.cy, r: 5, class: 'dot' }));

  // selective direct labels: top points by y, then x, skipping collisions
  const placed = [];
  for (const p of [...pts].sort((a, b) => b.y - a.y || b.x - a.x)) {
    if (placed.length >= labelTop) break;
    if (placed.some((q) => Math.abs(q.cx - p.cx) < 90 && Math.abs(q.cy - p.cy) < 14)) continue;
    const flip = p.cx + 10 + p.label.length * 6.2 > W - 4;
    root.append(svg('text', { x: p.cx + (flip ? -9 : 9), y: p.cy + 4, 'text-anchor': flip ? 'end' : 'start', class: 'dotlabel' }, p.label));
    placed.push(p);
  }

  const ring = svg('circle', { r: 9, class: 'ring', display: 'none' });
  const hit = svg('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' });
  hit.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let best = null, bd = Infinity;
    for (const p of pts) { const d = (p.cx - px) ** 2 + (p.cy - py) ** 2; if (d < bd) { bd = d; best = p; } }
    if (!best || bd > 16 * 16) { ring.setAttribute('display', 'none'); tip.hide(); return; }
    const group = pts.filter((p) => Math.abs(p.cx - best.cx) < 3 && Math.abs(p.cy - best.cy) < 3);
    ring.setAttribute('cx', best.cx); ring.setAttribute('cy', best.cy); ring.removeAttribute('display');
    tip.show(group.slice(0, 4).map((p) => p.tip).join('<hr>') +
      (group.length > 4 ? `<div class="r"><span>+${group.length - 4} more at this spot</span></div>` : ''), e);
  });
  hit.addEventListener('pointerleave', () => { ring.setAttribute('display', 'none'); tip.hide(); });
  root.append(ring, hit);
  plot.append(root);
}

// ---- lines ----
// opts: { series:[{name,color,dash?,points:[{x,y,tip}]}], xLabel, yLabel, xName:'Game', label }
// x values are integers (game numbers). Hover snaps to the nearest x and lists every series.
export function renderLines(container, opts) {
  container._lopts = opts;
  if (!container._lbuilt) {
    container.innerHTML = '<div class="legend"></div><div class="plot"></div>';
    container._plot = container.querySelector('.plot');
    let lastW = 0;
    new ResizeObserver(() => {
      const w = container._plot.clientWidth;
      if (w !== lastW) { lastW = w; drawLines(container); }
    }).observe(container._plot);
    container._lbuilt = true;
  }
  container.querySelector('.legend').innerHTML = opts.series.length < 2 ? '' : opts.series.map((s) =>
    `<span class="key"><i style="background:${s.color}"></i>${s.name}</span>`).join('');
  drawLines(container);
}

function drawLines(container) {
  const { series, xLabel, yLabel, label, xName = 'Game' } = container._lopts;
  const plot = container._plot;
  plot.textContent = '';
  const all = series.flatMap((s) => s.points);
  if (!all.length) { plot.innerHTML = '<p class="empty">No games to chart for this selection.</p>'; return; }

  const W = Math.max(plot.clientWidth, 300), H = W < 520 ? 270 : 330;
  const m = { top: 14, right: 40, bottom: 44, left: 48 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const maxX = Math.max(...all.map((p) => p.x));
  const xt = niceTicks(maxX, 8, true), yt = niceTicks(Math.max(1, ...all.map((p) => p.y)), 5, true);
  const X = (v) => m.left + (v / xt.max) * iw;
  const Y = (v) => m.top + ih - (v / yt.max) * ih;

  const root = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label || 'Line chart' });
  for (const t of yt.ticks) {
    root.append(
      svg('line', { x1: m.left, x2: W - m.right, y1: Y(t), y2: Y(t), class: t === 0 ? 'axis' : 'grid' }),
      svg('text', { x: m.left - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' }, String(t)),
    );
  }
  for (const t of xt.ticks) {
    root.append(svg('text', { x: X(t), y: m.top + ih + 16, 'text-anchor': 'middle', class: 'tick' }, String(t)));
  }
  root.append(
    svg('text', { x: m.left + iw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axtitle' }, xLabel),
    svg('text', { transform: `translate(12 ${m.top + ih / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'axtitle' }, yLabel),
  );

  const labelYs = [];
  for (const s of series) {
    if (!s.points.length) continue;
    const attrs = { d: s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${Y(p.y)}`).join(''), fill: 'none', stroke: s.color,
      'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    if (s.dash) attrs['stroke-dasharray'] = s.dash; // secondary encoding beyond color
    root.append(svg('path', attrs));
    const last = s.points[s.points.length - 1];
    root.append(svg('circle', { cx: X(last.x), cy: Y(last.y), r: 4, fill: s.color, class: 'endmark' }));
    if (!labelYs.some((y) => Math.abs(y - Y(last.y)) < 13)) {
      root.append(svg('text', { x: X(last.x) + 9, y: Y(last.y) + 4, class: 'endlabel' }, String(last.y)));
      labelYs.push(Y(last.y));
    }
  }

  const cross = svg('line', { y1: m.top, y2: m.top + ih, class: 'axis', display: 'none' });
  const marks = series.map((s) => svg('circle', { r: 5, fill: s.color, class: 'hovermark', display: 'none' }));
  const off = () => { cross.setAttribute('display', 'none'); marks.forEach((c) => c.setAttribute('display', 'none')); tip.hide(); };
  const hit = svg('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' });
  hit.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect();
    const xi = Math.min(maxX, Math.max(1, Math.round(((e.clientX - r.left - m.left) / iw) * xt.max)));
    const rows = series.map((s, i) => ({ s, i, p: s.points.find((q) => q.x === xi) })).filter((o) => o.p);
    if (!rows.length) return off();
    cross.setAttribute('x1', X(xi)); cross.setAttribute('x2', X(xi)); cross.removeAttribute('display');
    marks.forEach((c) => c.setAttribute('display', 'none'));
    for (const o of rows) { marks[o.i].setAttribute('cx', X(xi)); marks[o.i].setAttribute('cy', Y(o.p.y)); marks[o.i].removeAttribute('display'); }
    tip.show(`<b>${xName} ${xi}</b>` + rows.map((o) =>
      `<div class="r"><span><i class="swatch" style="background:${o.s.color}"></i>${o.s.name}</span><span>${o.p.tip}</span></div>`).join(''), e);
  });
  hit.addEventListener('pointerleave', off);
  root.append(cross, ...marks, hit);
  plot.append(root);
}
