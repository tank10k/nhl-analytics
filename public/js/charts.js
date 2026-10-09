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
function niceTicks(max, target) {
  if (!(max > 0)) return { ticks: [0, 1], max: 1 };
  const raw = max / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
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
  container.querySelector('.legend').innerHTML = opts.series.map((s) =>
    `<span class="key"><i style="background:${s.color}"></i>${s.name}</span>`).join('');
  draw(container);
}

function draw(container) {
  const { rows, series, mode, label, rowH = 22 } = container._opts;
  const plot = container._plot;
  plot.textContent = '';
  if (!rows.length) { plot.innerHTML = '<p class="empty">No data for this selection.</p>'; return; }

  const W = Math.max(plot.clientWidth, 300);
  const m = { top: 26, left: 44, right: 74, bottom: 4 };
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
