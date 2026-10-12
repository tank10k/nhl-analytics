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
  ppPoints: number;
  gwg: number;
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
