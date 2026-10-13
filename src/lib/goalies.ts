// Goalie measures built from the league goalie list. Shared by the Goalies hub, goalie
// cards and goalie pages so every view ranks goalies the same way.

import type { Goalie } from './types';
import type { CardPct } from './cards';
import { fmtDec, fmtSv } from './format';

export interface GoalieRow extends Goalie {
  /** Saves beyond what a league-average goalie would make on the same shots. */
  gsaa: number | null;
  gsaaPer60: number | null;
  saPer60: number | null;
  winPct: number | null;
  qualified: boolean;
}

export interface GoalieLeague {
  rows: GoalieRow[];
  /** League save percentage: all saves over all shots against. */
  leagueSv: number | null;
  /** Games played needed to be ranked: a quarter of the league high, capped at 20. */
  minGp: number;
  qualifiedCount: number;
}

export function goalieLeague(goalies: Goalie[]): GoalieLeague {
  const saves = goalies.reduce((a, g) => a + (g.saves ?? 0), 0);
  const sa = goalies.reduce((a, g) => a + (g.shotsAgainst ?? 0), 0);
  const leagueSv = sa ? saves / sa : null;
  const maxGp = Math.max(0, ...goalies.map((g) => g.gp));
  const minGp = Math.max(1, Math.min(20, Math.ceil(maxGp * 0.25)));
  const rows = goalies.map((g): GoalieRow => {
    const hours = g.toi ? g.toi / 3600 : null;
    const gsaa = leagueSv != null && g.shotsAgainst != null && g.saves != null
      ? g.saves - g.shotsAgainst * leagueSv : null;
    return {
      ...g,
      gsaa,
      gsaaPer60: gsaa != null && hours ? gsaa / hours : null,
      saPer60: g.shotsAgainst != null && hours ? g.shotsAgainst / hours : null,
      winPct: g.wins != null && g.gp ? g.wins / g.gp : null,
      qualified: g.gp >= minGp,
    };
  });
  return { rows, leagueSv, minGp, qualifiedCount: rows.filter((r) => r.qualified).length };
}

/** Percentile (1–99) of `v` within `pool`; ties share the midpoint. */
function pctOf(pool: number[], v: number, higherIsBetter: boolean): number {
  let below = 0, equal = 0;
  for (const x of pool) {
    if (x === v) equal++;
    else if (higherIsBetter ? x < v : x > v) below++;
  }
  const p = Math.round(((below + equal / 2) / pool.length) * 100);
  return Math.max(1, Math.min(99, p));
}

const MEASURES: { key: keyof GoalieRow; label: string; better: 'high' | 'low'; fmt: (v: number) => string }[] = [
  { key: 'savePct', label: 'Save %', better: 'high', fmt: fmtSv },
  { key: 'gsaa', label: 'Saves above avg', better: 'high', fmt: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}` },
  { key: 'gaa', label: 'Goals against avg', better: 'low', fmt: (v) => fmtDec(v) },
  { key: 'winPct', label: 'Win rate', better: 'high', fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'gs', label: 'Workload (starts)', better: 'high', fmt: (v) => String(v) },
  { key: 'shutouts', label: 'Shutouts', better: 'high', fmt: (v) => String(v) },
];

/** Card rows for one goalie: percentile among qualified goalies on six measures. */
export function goalieRanks(league: GoalieLeague | null, id: number): { pct: CardPct[]; note: string | null } | null {
  if (!league) return null;
  const me = league.rows.find((r) => r.id === id);
  if (!me) return null;
  if (!me.qualified) return { pct: [], note: `Ranks appear after ${league.minGp} games played.` };
  const pool = league.rows.filter((r) => r.qualified);
  const pct = MEASURES.flatMap((m) => {
    const v = me[m.key] as number | null;
    if (v == null) return [];
    const values = pool.map((r) => r[m.key] as number | null).filter((x): x is number => x != null);
    return [{ key: String(m.key), label: m.label, value: m.fmt(v), pct: pctOf(values, v, m.better === 'high') }];
  });
  return { pct, note: `Percentile among ${pool.length} goalies with ${league.minGp}+ games` };
}
