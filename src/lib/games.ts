// Display helpers for game state and times.
import type { GameSummary } from './types';
import { ordinal } from './format';

export function periodName(n: number | null, type?: string | null): string {
  if (type === 'SO') return 'Shootout';
  if (type === 'OT' || (n != null && n > 3)) return n != null && n > 4 ? `${n - 3}OT` : 'OT';
  return n ? `${ordinal(n)}` : '';
}

/** "Final", "Final/OT", "2nd 7:42", "2nd intermission", "7:00 PM" */
export function gameStatus(g: Pick<GameSummary, 'state' | 'final' | 'live' | 'period' | 'periodType' | 'clock' | 'intermission' | 'decidedIn' | 'start'>): string {
  if (g.final) return g.decidedIn && g.decidedIn !== 'REG' ? `Final/${g.decidedIn}` : 'Final';
  if (g.live) {
    if (g.intermission) return `${periodName(g.period, g.periodType)} intermission`;
    return `${periodName(g.period, g.periodType)}${g.clock ? ` ${g.clock.replace(/^0/, '')}` : ''}`;
  }
  if (g.state === 'PPD') return 'Postponed';
  return g.start ? new Date(g.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Scheduled';
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** Elapsed game time in minutes for a shot (regular periods are 20 minutes, regular-season OT 5). */
export function gameMinute(period: number, sec: number | null, gameType = 2): number {
  const s = sec ?? 0;
  if (period <= 3) return ((period - 1) * 1200 + s) / 60;
  const otLen = gameType === 3 ? 1200 : 300;
  return (3600 + (period - 4) * otLen + s) / 60;
}
