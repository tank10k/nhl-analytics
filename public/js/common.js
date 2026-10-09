// Shared helpers for all pages.

export async function api(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const seasonLabel = (id) => `${id.slice(0, 4)}–${id.slice(6)}`;
export const signed = (n) => (n == null ? '–' : n > 0 ? `+${n}` : String(n));
export const fmtPct = (p) => (p == null ? '–' : p.toFixed(3).replace(/^0/, ''));
export const rec = (r) => `${r.w}-${r.l}-${r.otl}`;

// Theme: auto (follow OS) -> light -> dark. Stored per browser, optional.
export function initTheme(btn) {
  const order = [null, 'light', 'dark'];
  const read = () => { try { return localStorage.getItem('theme'); } catch { return null; } };
  const write = (v) => { try { v ? localStorage.setItem('theme', v) : localStorage.removeItem('theme'); } catch { /* private mode */ } };
  const apply = (v) => {
    if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
    btn.textContent = `Theme: ${v ? v[0].toUpperCase() + v.slice(1) : 'Auto'}`;
  };
  let cur = order.includes(read()) ? read() : null;
  apply(cur);
  btn.addEventListener('click', () => {
    cur = order[(order.indexOf(cur) + 1) % order.length];
    write(cur);
    apply(cur);
  });
}

// Fills the season <select> (modern era only, newest first) and keeps ?season= in the URL.
export async function initSeasonSelect(select, onChange) {
  const d = await api('/api/seasons');
  const ids = new Set(d.seasons.map((s) => s.id).filter((id) => id >= '20052006'));
  ids.add(d.current);
  const list = [...ids].sort().reverse();
  select.innerHTML = list.map((id) =>
    `<option value="${id}">${seasonLabel(id)}${id === d.current ? ' (current)' : ''}</option>`).join('');
  const want = new URLSearchParams(location.search).get('season');
  select.value = list.includes(want) ? want : d.current;
  select.addEventListener('change', () => {
    const u = new URL(location.href);
    u.searchParams.set('season', select.value);
    history.replaceState(null, '', u);
    onChange(select.value);
  });
  return select.value;
}
