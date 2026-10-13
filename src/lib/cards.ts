// Turns API data into what a player card shows. Kept separate from the component so
// the Players hub, player page, team rosters (step 4) and Compare (step 6) build cards
// the same way.

import type { GameLogEntry, Player, PlayerPercentiles, PlayerSeason, PercentileKey } from './types';
import { fmtDec, fmtMetric, fmtSigned, fmtSv, seasonLabel } from './format';

export interface CardStat { label: string; value: string; title?: string }
export interface CardPct { key: string; label: string; value: string; pct: number }

export interface CardData {
  id: number;
  firstName: string;
  lastName: string;
  team: string | null;
  teamName: string | null;
  teamLogo: string | null;
  pos: Player['pos'];
  number: number | null;
  headshot: string | null;
  bio: Player['bio'] | null;
  season: string;
  line: CardStat[];
  pct: CardPct[];
  pctNote: string | null;
  spark: { values: (number | null)[]; kind: 'bar' | 'line'; caption: string } | null;
  career: PlayerSeason[];
  awards: Player['awards'];
}

/** Six measures that best describe a skater at a glance, in card order. */
const CARD_METRICS: Record<'F' | 'D', PercentileKey[]> = {
  F: ['pointsPer60', 'goalsPer60', 'shotsPer60', 'ppPointsPerGame', 'toiPerGame', 'hitsPer60'],
  D: ['pointsPer60', 'toiPerGame', 'shotsPer60', 'blocksPer60', 'plusMinusPerGame', 'hitsPer60'],
};

const SHORT: Partial<Record<PercentileKey, string>> = {
  pointsPer60: 'Points/60',
  goalsPer60: 'Goals/60',
  assistsPer60: 'Assists/60',
  shotsPer60: 'Shots/60',
  ppPointsPerGame: 'PP points/GP',
  toiPerGame: 'Ice time',
  hitsPer60: 'Hits/60',
  blocksPer60: 'Blocks/60',
  plusMinusPerGame: '+/− per GP',
  shootingPct: 'Shooting %',
  takeawaysPer60: 'Takeaways/60',
};

/** Combine a season's rows (a traded player has one per team). */
export function seasonTotals(rows: PlayerSeason[], season: string): PlayerSeason | null {
  const r = rows.filter((x) => x.season === season);
  if (!r.length) return null;
  if (r.length === 1) return r[0];
  const sum = (k: keyof PlayerSeason) => r.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  const gp = sum('gp');
  const wavg = (k: keyof PlayerSeason) => (gp ? r.reduce((a, x) => a + (Number(x[k]) || 0) * x.gp, 0) / gp : null);
  return {
    season, gameType: 2, team: r.map((x) => x.team).join(' / '), gp,
    goals: sum('goals'), assists: sum('assists'), points: sum('points'), shots: sum('shots'),
    plusMinus: sum('plusMinus'), pim: sum('pim'), ppGoals: sum('ppGoals'), ppPoints: sum('ppPoints'), gwg: sum('gwg'),
    wins: sum('wins'), losses: sum('losses'), otLosses: sum('otLosses'), shutouts: sum('shutouts'),
    savePct: wavg('savePct'), gaa: wavg('gaa'),
  };
}

/** Game logs come newest-first; return oldest-first. */
export function chronological(games: GameLogEntry[]): GameLogEntry[] {
  return [...games].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildCard(player: Player, season: string, opts: {
  percentiles?: PlayerPercentiles | null;
  games?: GameLogEntry[] | null;
  /** Goalie ranks, built from the league goalie list (see lib/goalies.ts). */
  goalieRanks?: { pct: CardPct[]; note: string | null } | null;
} = {}): CardData {
  const isGoalie = player.pos === 'G';
  const s = seasonTotals(player.seasons, season);

  const line: CardStat[] = isGoalie
    ? [
        { label: 'GP', value: String(s?.gp ?? 0), title: 'Games played' },
        { label: 'W', value: String(s?.wins ?? 0), title: 'Wins' },
        { label: 'SV%', value: fmtSv(s?.savePct), title: 'Save percentage' },
        { label: 'GAA', value: fmtDec(s?.gaa ?? null), title: 'Goals against average' },
        { label: 'SO', value: String(s?.shutouts ?? 0), title: 'Shutouts' },
      ]
    : [
        { label: 'GP', value: String(s?.gp ?? 0), title: 'Games played' },
        { label: 'G', value: String(s?.goals ?? 0), title: 'Goals' },
        { label: 'A', value: String(s?.assists ?? 0), title: 'Assists' },
        { label: 'P', value: String(s?.points ?? 0), title: 'Points' },
        { label: '+/−', value: fmtSigned(s?.plusMinus ?? 0), title: 'Plus/minus' },
      ];

  let pct: CardPct[] = isGoalie && opts.goalieRanks ? opts.goalieRanks.pct : [];
  let pctNote: string | null = isGoalie && opts.goalieRanks ? opts.goalieRanks.note : null;
  const pr = opts.percentiles;
  if (!isGoalie && pr) {
    if (!pr.eligible) {
      pctNote = `Ranks appear after ${pr.minGp} games played.`;
    } else {
      pct = CARD_METRICS[pr.group].flatMap((key) => {
        const p = pr.pct[key];
        if (p == null) return [];
        return [{ key, label: SHORT[key] ?? key, value: fmtMetric(key, pr.values[key]), pct: p }];
      });
      pctNote = `Percentile among ${pr.poolSize} ${pr.group === 'D' ? 'defensemen' : 'forwards'}`;
    }
  }

  let spark: CardData['spark'] = null;
  if (opts.games?.length) {
    const last = chronological(opts.games).slice(-10);
    if (isGoalie) {
      spark = {
        values: last.map((g) => g.savePct),
        kind: 'line',
        caption: `Save % over last ${last.length} games`,
      };
    } else {
      const pts = last.reduce((a, g) => a + g.points, 0);
      spark = {
        values: last.map((g) => g.points),
        kind: 'bar',
        caption: `${pts} point${pts === 1 ? '' : 's'} in last ${last.length} games`,
      };
    }
  }

  const [first, ...rest] = player.name.split(' ');
  return {
    id: player.id,
    firstName: player.firstName ?? first,
    lastName: player.lastName ?? rest.join(' '),
    team: player.team,
    teamName: player.teamName,
    teamLogo: player.teamLogo,
    pos: player.pos,
    number: player.number,
    headshot: player.headshot,
    bio: player.bio,
    season: seasonLabel(season),
    line,
    pct,
    pctNote,
    spark,
    career: player.seasons,
    awards: player.awards,
  };
}
