// Minimal stroke icons (24px grid, inherit currentColor).
import type { SVGProps } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconLeague = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="6" /><path d="M12 5v14M3 12h3M18 12h3" /><circle cx="12" cy="12" r="2.5" /></svg>
);
export const IconTeams = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /></svg>
);
export const IconPlayers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3h-2a2 2 0 01-4 0H8z" /></svg>
);
export const IconCompare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M7 4v16M17 4v16M3 9l4-5 4 5M13 15l4 5 4-5" /></svg>
);
export const IconGames = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M12 6v12M7 10v4M17 10v4" /></svg>
);
export const IconGoalies = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><path d="M4 20V8a8 8 0 0116 0v12" /><path d="M4 14h16M9 20v-6M15 20v-6" /></svg>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
);
