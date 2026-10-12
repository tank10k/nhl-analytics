// Team identity: colors for every franchise in the 2005-06+ range the app covers.
// primary/secondary are the official-style jersey colors; `accent` is computed so
// it stays readable on the app's dark surfaces (see teamAccent).

export interface TeamColors {
  primary: string;
  secondary: string;
}

export const TEAM_COLORS: Record<string, TeamColors> = {
  ANA: { primary: '#F47A38', secondary: '#B9975B' },
  ARI: { primary: '#8C2633', secondary: '#E2D6B5' },
  ATL: { primary: '#041E42', secondary: '#5C88DA' },
  BOS: { primary: '#FFB81C', secondary: '#000000' },
  BUF: { primary: '#003087', secondary: '#FFB81C' },
  CAR: { primary: '#CE1126', secondary: '#000000' },
  CBJ: { primary: '#002654', secondary: '#CE1126' },
  CGY: { primary: '#C8102E', secondary: '#F1BE48' },
  CHI: { primary: '#CF0A2C', secondary: '#000000' },
  COL: { primary: '#6F263D', secondary: '#236192' },
  DAL: { primary: '#006847', secondary: '#8F8F8C' },
  DET: { primary: '#CE1126', secondary: '#FFFFFF' },
  EDM: { primary: '#041E42', secondary: '#FF4C00' },
  FLA: { primary: '#C8102E', secondary: '#B9975B' },
  LAK: { primary: '#111111', secondary: '#A2AAAD' },
  MIN: { primary: '#154734', secondary: '#A6192E' },
  MTL: { primary: '#AF1E2D', secondary: '#192168' },
  NJD: { primary: '#CE1126', secondary: '#000000' },
  NSH: { primary: '#FFB81C', secondary: '#041E42' },
  NYI: { primary: '#00539B', secondary: '#F47D30' },
  NYR: { primary: '#0038A8', secondary: '#CE1126' },
  OTT: { primary: '#C52032', secondary: '#C2912C' },
  PHI: { primary: '#F74902', secondary: '#000000' },
  PHX: { primary: '#8C2633', secondary: '#E2D6B5' },
  PIT: { primary: '#FCB514', secondary: '#000000' },
  SEA: { primary: '#001628', secondary: '#99D9D9' },
  SJS: { primary: '#006D75', secondary: '#EA7200' },
  STL: { primary: '#002F87', secondary: '#FCB514' },
  TBL: { primary: '#002868', secondary: '#FFFFFF' },
  TOR: { primary: '#00205B', secondary: '#FFFFFF' },
  UTA: { primary: '#6CACE4', secondary: '#010101' },
  VAN: { primary: '#00205B', secondary: '#00843D' },
  VGK: { primary: '#B4975A', secondary: '#333F42' },
  WPG: { primary: '#041E42', secondary: '#AC162C' },
  WSH: { primary: '#041E42', secondary: '#C8102E' },
};

const FALLBACK: TeamColors = { primary: '#3A4B66', secondary: '#8FA3BF' };

export function teamColors(abbrev?: string | null): TeamColors {
  return (abbrev && TEAM_COLORS[abbrev]) || FALLBACK;
}

// ---- contrast helpers (WCAG relative luminance) ----
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}

const SURFACE = '#101d33'; // --surface-1, the panel color the accent is drawn on
const accentCache = new Map<string, string>();

/** A team color that reads on the dark panels: primary if it has 3:1 contrast,
 *  else secondary (unless white/black), else primary lightened until it does. */
export function teamAccent(abbrev?: string | null): string {
  const key = abbrev || '';
  const hit = accentCache.get(key);
  if (hit) return hit;
  const { primary, secondary } = teamColors(abbrev);
  let out = primary;
  if (contrast(primary, SURFACE) < 3) {
    const usableSecondary = !/^#(ffffff|000000|010101)$/i.test(secondary) && contrast(secondary, SURFACE) >= 3;
    if (usableSecondary) out = secondary;
    else {
      for (let t = 0.1; t <= 0.9; t += 0.05) {
        out = mix(primary, '#ffffff', t);
        if (contrast(out, SURFACE) >= 3) break;
      }
    }
  }
  accentCache.set(key, out);
  return out;
}

/** NHL logo URLs come as ..._light.svg; the _dark variant is drawn for dark backgrounds. */
export function darkLogo(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/_light\.svg$/, '_dark.svg');
}
