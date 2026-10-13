// Shapes returned by server.js (/api/*). Keep in sync with the loaders there.

export interface Record3 {
  w: number;
  l: number;
  otl: number;
}

export interface Team {
  abbrev: string;
  name: string;
  logo?: string;
  conference: string;
  division: string;
  gp: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  pointPct: number;
  regWins: number;
  regOtWins: number;
  gf: number;
  ga: number;
  goalDiff: number;
  home: Record3;
  road: Record3;
  l10: Record3;
  streak: string | null;
  rank: { league: number; conference: number; division: number };
}

export interface StandingsResponse {
  season: string;
  teams: Team[];
}

export interface Skater {
  id: number;
  name: string;
  teams: string[];
  pos: 'C' | 'L' | 'R' | 'D';
  shoots: 'L' | 'R' | null;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  shootingPct: number | null;
  plusMinus: number;
  pim: number;
  toiPerGame: number;
  pointsPerGame: number;
  evGoals: number | null;
  evPoints: number | null;
  ppGoals: number | null;
  ppPoints: number | null;
  shGoals: number | null;
  gwg: number;
  otGoals: number | null;
  faceoffPct: number | null;
  hits: number | null;
  blocks: number | null;
  giveaways: number | null;
  takeaways: number | null;
}

export interface SkatersResponse {
  season: string;
  gameType: string;
  total: number;
  players: Skater[];
}

export interface SeasonInfo {
  id: string;
  standingsStart: string;
  standingsEnd: string;
}

export interface SeasonsResponse {
  current: string;
  seasons: SeasonInfo[];
}

// ---------- Step 2 additions ----------

export interface Goalie {
  id: number;
  name: string;
  teams: string[];
  catches: 'L' | 'R' | null;
  gp: number;
  gs: number | null;
  wins: number | null;
  losses: number | null;
  otLosses: number | null;
  shutouts: number | null;
  savePct: number | null;
  gaa: number | null;
  saves: number | null;
  shotsAgainst: number | null;
  goalsAgainst: number | null;
  toi: number | null;
}
export interface GoaliesResponse { season: string; gameType: string; total: number; goalies: Goalie[] }

export interface TeamStats {
  abbrev: string | null;
  teamId: number;
  name: string;
  logo: string | null;
  gp: number;
  goalsForPerGame: number | null;
  goalsAgainstPerGame: number | null;
  shotsForPerGame: number | null;
  shotsAgainstPerGame: number | null;
  shotShare: number | null;
  shootingPct: number | null;
  savePct: number | null;
  pdo: number | null;
  powerPlayPct: number | null;
  penaltyKillPct: number | null;
  faceoffPct: number | null;
  pointPct: number | null;
}
export interface TeamStatsResponse { season: string; gameType: string; teams: TeamStats[] }

export type GameResult = 'W' | 'L' | 'OTL';

export interface ScheduleGame {
  id: number;
  date: string;
  gameType: number;
  state: string;
  home: boolean;
  opp: string | null;
  oppLogo: string | null;
  gf: number | null;
  ga: number | null;
  result: GameResult | null;
  decidedIn: 'REG' | 'OT' | 'SO' | null;
  gameNumber: number | null;  // regular-season games only
  points: number | null;      // running points total after this game
}
export interface ScheduleResponse { team: string; season: string; games: ScheduleGame[] }

export interface RaceTeam {
  abbrev: string;
  name: string;
  logo?: string;
  conference: string;
  division: string;
  games: { n: number; date: string; result: GameResult; points: number; gf: number; ga: number }[];
}
export interface RaceResponse { season: string; teams: RaceTeam[] }

export interface PlayerBio {
  birthDate: string | null;
  age: number | null;
  birthPlace: string | null;
  country: string | null;
  heightIn: number | null;
  heightCm: number | null;
  weightLb: number | null;
  weightKg: number | null;
  shoots: 'L' | 'R' | null;
  draft: { year: number; team: string; round: number; pick: number; overall: number } | null;
}

export interface PlayerSeason {
  season: string;
  gameType: number;
  team: string;
  gp: number;
  // skaters
  goals?: number; assists?: number; points?: number; shots?: number | null; plusMinus?: number | null;
  pim?: number | null; ppGoals?: number | null; ppPoints?: number | null; gwg?: number | null;
  shootingPct?: number | null; avgToi?: string | null;
  // goalies
  wins?: number | null; losses?: number | null; otLosses?: number | null; savePct?: number | null;
  gaa?: number | null; shutouts?: number | null;
}

export interface Player {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  team: string | null;
  teamName: string | null;
  teamLogo: string | null;
  pos: 'C' | 'L' | 'R' | 'D' | 'G';
  number: number | null;
  active: boolean | null;
  headshot: string | null;
  heroImage: string | null;
  bio: PlayerBio;
  seasons: PlayerSeason[];
  playoffs: PlayerSeason[];
  awards: { name: string; seasons: string[] }[];
}

export interface GameLogEntry {
  gameId: number | null;
  date: string;
  opp: string;
  homeRoad: 'H' | 'R';
  goals: number; assists: number; points: number; shots: number;
  plusMinus: number; pim: number; toi: string;
  decision: string | null; savePct: number | null; shotsAgainst: number | null; goalsAgainst: number | null;
}

export type PercentileKey =
  | 'pointsPer60' | 'goalsPer60' | 'assistsPer60' | 'shotsPer60' | 'shootingPct' | 'toiPerGame'
  | 'ppPointsPerGame' | 'plusMinusPerGame' | 'hitsPer60' | 'blocksPer60' | 'takeawaysPer60';

export interface PercentileMetric { key: PercentileKey; label: string; better: 'high' | 'low' }

export interface PlayerPercentiles {
  season: string;
  gameType: string;
  minGp: number;
  poolSize: number;
  metrics: PercentileMetric[];
  id: number;
  name: string;
  group: 'F' | 'D';
  eligible: boolean;
  values: Record<PercentileKey, number | null>;
  pct: Record<PercentileKey, number | null>;   // 0-100, null when not ranked
}

export type ShotKind = 'goal' | 'shot' | 'miss' | 'block';
export type Strength = '5v5' | 'EV' | 'PP' | 'SH';

/** Shot with the attacking net at x = +89 (feet), y from -42.5 to 42.5. */
export interface Shot {
  team: string;
  shooter: number | null;
  goalie: number | null;
  kind: ShotKind;
  type: string | null;
  period: number;
  sec: number | null;
  x: number;
  y: number;
  dist: number;
  angle: number;
  strength: Strength;
  emptyNet: boolean;
  rebound: boolean;
  xg: number;
}

export interface GameShotsResponse {
  model: string;
  game: {
    id: number; season: string; gameType: number; date: string; state: string;
    home: { abbrev: string; score: number | null; logo: string | null };
    away: { abbrev: string; score: number | null; logo: string | null };
  };
  shots: Shot[];
}

/** Season shot rows are compact arrays: [x, y, xg, kind, strength, period, gameIndex]. */
export type CompactShot = [number, number, number, ShotKind, Strength, number, number];

export interface ShotTotals { attempts: number; unblocked: number; onGoal: number; goals: number; xg: number }
export interface ShotSplit {
  for: ShotTotals; against: ShotTotals;
  corsiPct: number | null; fenwickPct: number | null; xgPct: number | null;
}

export interface TeamShotsResponse {
  team: string; season: string; gameType: string; model: string;
  gamesRequested: number; gamesLoaded: number;
  summary: { all: ShotSplit; fiveOnFive: ShotSplit };
  games: { id: number; date: string; opp: string; home: boolean; result: GameResult; gf: number; ga: number;
    xgFor: number; xgAgainst: number; attemptsFor: number; attemptsAgainst: number }[];
  columns: string[];
  for: CompactShot[];
  against: CompactShot[];
}

export interface PlayerShotsResponse {
  playerId: number; season: string; gameType: string; model: string;
  gamesRequested: number; gamesLoaded: number;
  summary: ShotTotals & { goalsAboveExpected: number };
  games: { id: number; date: string; attempts: number; goals: number; xg: number }[];
  columns: string[];
  shots: CompactShot[];
}

// ---------- Step 7: games ----------

export interface GameTeam {
  abbrev: string;
  name: string | null;
  logo: string | null;
  score: number | null;
  sog: number | null;
}

export interface GameSummary {
  id: number;
  date: string | null;
  start: string | null;        // ISO UTC start time
  gameType: number | null;
  state: string | null;        // FUT, PRE, LIVE, CRIT, FINAL, OFF
  live: boolean;
  final: boolean;
  period: number | null;
  periodType: string | null;   // REG, OT, SO
  clock: string | null;        // "07:42" remaining in the period
  intermission: boolean;
  decidedIn: string | null;
  venue: string | null;
  away: GameTeam;
  home: GameTeam;
}

export interface ScoresResponse {
  date: string;
  prevDate: string | null;
  nextDate: string | null;
  anyLive: boolean;
  games: GameSummary[];
}

export interface RosterSpot { id: number; team: string; name: string; number: number | null; pos: string | null }

export interface GameDetail {
  id: number; season: string; gameType: number; date: string; state: string;
  home: { abbrev: string; score: number | null; logo: string | null };
  away: { abbrev: string; score: number | null; logo: string | null };
  lastPeriod: number | null;
  lastPeriodType: string | null;
  clock: string | null;
  intermission: boolean;
}

export interface GameShotsFull {
  model: string;
  game: GameDetail;
  roster: RosterSpot[];
  shots: (Shot & { assists?: number[] })[];
}

export interface BoxSkater {
  id: number; name: string | null; number: number | null; pos: string | null;
  goals: number; assists: number; points: number; plusMinus: number | null; pim: number | null;
  hits: number | null; sog: number | null; blocks: number | null; ppGoals: number | null;
  faceoffPct: number | null; toi: string | null;
}
export interface BoxGoalie {
  id: number; name: string | null; number: number | null; saves: number | null; shotsAgainst: number | null;
  goalsAgainst: number | null; savePct: number | null; toi: string | null; decision: string | null; starter: boolean | null;
}
export interface BoxSide extends GameTeam { skaters: BoxSkater[]; goalies: BoxGoalie[] }
export interface BoxResponse { id: number; state: string | null; final: boolean; away: BoxSide; home: BoxSide }

// ---------- Step 8: goalies ----------

export interface GoalieShotsResponse {
  playerId: number; season: string; gameType: string; model: string;
  gamesRequested: number; gamesLoaded: number;
  summary: { faced: number; onGoal: number; goalsAgainst: number; xga: number; gsax: number; highDanger: { faced: number; goalsAgainst: number } };
  games: { id: number; date: string; faced: number; onGoal: number; goalsAgainst: number; xga: number; gsax: number }[];
  columns: string[];
  shots: CompactShot[];
}
