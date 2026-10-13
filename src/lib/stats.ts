// Small numeric helpers shared by charts.

/** Trailing average over `w` values; null until the window is full. */
export function rolling(values: (number | null)[], w: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < w - 1) return null;
    const win = values.slice(i - w + 1, i + 1).filter((v): v is number => v != null);
    return win.length ? win.reduce((a, v) => a + v, 0) / win.length : null;
  });
}

/**
 * Average of the last `w` values, using however many exist so far: game 1 averages one
 * game, game 2 two, and so on up to `w`. Lines start at game 1 instead of staying empty
 * until a full window is available (which matters early in a season).
 */
export function trailing(values: (number | null)[], w: number): (number | null)[] {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v != null);
    return win.length ? win.reduce((a, v) => a + v, 0) / win.length : null;
  });
}

/** Show every game number on short seasons-so-far, every 10th once there are many. */
export const gameAxisInterval = (n: number) => (i: number) => n <= 15 || (i + 1) % 10 === 0;

/** 1-based rank of `value` among `all` (ties share the best rank). */
export function rankOf(all: number[], value: number, higherIsBetter = true): number {
  return all.filter((v) => (higherIsBetter ? v > value : v < value)).length + 1;
}

export type PercentilesTable = {
  minGp: number;
  poolSize: { F: number; D: number };
  metrics: import('./types').PlayerPercentiles['metrics'];
  players: import('./types').PlayerPercentiles[];
};
