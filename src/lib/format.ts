export const fmtInt = (n: number | null | undefined) => (n == null ? '–' : String(Math.round(n)));

export const fmtSigned = (n: number | null | undefined) =>
  n == null ? '–' : n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';

export const fmtDec = (n: number | null | undefined, digits = 2) => (n == null ? '–' : n.toFixed(digits));

/** 0.6125 -> ".613" (hockey convention for point %) */
export const fmtPct3 = (n: number | null | undefined) =>
  n == null ? '–' : n >= 1 ? '1.000' : n.toFixed(3).replace(/^0/, '');

/** 0.164 -> "16.4%" */
export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null ? '–' : `${(n * 100).toFixed(digits)}%`;

/** seconds -> "m:ss" */
export const fmtToi = (sec: number | null | undefined) => {
  if (sec == null) return '–';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const recordStr = (w: number, l: number, otl: number) => `${w}–${l}–${otl}`;

/** "20252026" -> "2025–26" */
export const seasonLabel = (id: string) => `${id.slice(0, 4)}–${id.slice(6)}`;

export const posLabel: Record<string, string> = { C: 'Center', L: 'Left wing', R: 'Right wing', D: 'Defense', G: 'Goalie' };

/** 73 -> 6′1″ */
export const fmtHeight = (inches: number | null | undefined) =>
  inches == null ? '–' : `${Math.floor(inches / 12)}′${inches % 12}″`;

/** 1 -> "1st", 22 -> "22nd" */
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** ".918" style for save percentage */
export const fmtSv = (n: number | null | undefined) => (n == null ? '–' : n.toFixed(3).replace(/^0/, ''));

/** Stat value with the right precision for a percentile metric */
export function fmtMetric(key: string, v: number | null | undefined): string {
  if (v == null) return '–';
  if (key === 'toiPerGame') return fmtToi(v);
  if (key === 'shootingPct') return fmtPct(v);
  if (key === 'plusMinusPerGame' || key === 'ppPointsPerGame') return v.toFixed(2);
  return v.toFixed(2);
}
