'use strict';
// Scoreboard (games on a date) and box scores. Field names follow the community API
// reference; anything missing comes back as null rather than breaking the response.

const { getJson, TTL } = require('./cache');
const { WEB } = require('./loaders');
const { HttpError, dflt, num } = require('./util');

const LIVE = new Set(['LIVE', 'CRIT']);
const FINAL = new Set(['OFF', 'FINAL']);

function team(t) {
  if (!t) return null;
  return {
    abbrev: t.abbrev ?? null,
    name: dflt(t.name) || [dflt(t.placeName), dflt(t.commonName)].filter(Boolean).join(' ') || null,
    logo: t.logo ?? null,
    score: num(t.score),
    sog: num(t.sog),
  };
}

function gameSummary(g) {
  return {
    id: g.id,
    date: g.gameDate ?? null,
    start: g.startTimeUTC ?? null,
    gameType: g.gameType ?? null,
    state: g.gameState ?? null,
    live: LIVE.has(g.gameState),
    final: FINAL.has(g.gameState),
    period: g.periodDescriptor?.number ?? g.period ?? null,
    periodType: g.periodDescriptor?.periodType ?? null,
    clock: g.clock?.timeRemaining ?? null,
    intermission: g.clock?.inIntermission ?? false,
    decidedIn: g.gameOutcome?.lastPeriodType ?? null,
    venue: dflt(g.venue) ?? null,
    away: team(g.awayTeam),
    home: team(g.homeTeam),
  };
}

/** Games on a date (YYYY-MM-DD), or today's slate when no date is given. */
async function getScores(date) {
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date must look like 2026-10-12');
  const today = new Date().toISOString().slice(0, 10);
  const ttl = !date || date >= today ? TTL.scores : TTL.past;
  const d = await getJson(`${WEB}/score/${date || 'now'}`, ttl);
  const games = (d.games || []).map(gameSummary);
  return {
    date: d.currentDate ?? date ?? today,
    prevDate: d.prevDate ?? null,
    nextDate: d.nextDate ?? null,
    anyLive: games.some((g) => g.live),
    games,
  };
}

function skater(p) {
  return {
    id: p.playerId,
    name: dflt(p.name) ?? null,
    number: p.sweaterNumber ?? null,
    pos: p.position ?? null,
    goals: num(p.goals) ?? 0,
    assists: num(p.assists) ?? 0,
    points: num(p.points) ?? (num(p.goals) ?? 0) + (num(p.assists) ?? 0),
    plusMinus: num(p.plusMinus),
    pim: num(p.pim),
    hits: num(p.hits),
    sog: num(p.sog) ?? num(p.shots),
    blocks: num(p.blockedShots),
    ppGoals: num(p.powerPlayGoals),
    faceoffPct: num(p.faceoffWinningPctg),
    toi: p.toi ?? null,
  };
}

function goalie(p) {
  const [saves, shots] = String(p.saveShotsAgainst || '').split('/').map(Number);
  return {
    id: p.playerId,
    name: dflt(p.name) ?? null,
    number: p.sweaterNumber ?? null,
    saves: Number.isFinite(saves) ? saves : null,
    shotsAgainst: Number.isFinite(shots) ? shots : num(p.shotsAgainst),
    goalsAgainst: num(p.goalsAgainst),
    savePct: num(p.savePctg),
    toi: p.toi ?? null,
    decision: p.decision ?? null,
    starter: p.starter ?? null,
  };
}

/** Player stats for one game, both teams. */
async function getBox(gameId) {
  if (!/^\d{10}$/.test(String(gameId))) throw new HttpError(400, 'game id must be 10 digits, e.g. 2025020001');
  const b = await getJson(`${WEB}/gamecenter/${gameId}/boxscore`, TTL.live);
  const side = (key) => {
    const s = b.playerByGameStats?.[key] || {};
    return {
      ...team(b[key]),
      skaters: [...(s.forwards || []), ...(s.defense || [])].map(skater),
      goalies: (s.goalies || []).map(goalie).filter((g) => g.toi && g.toi !== '00:00'),
    };
  };
  return {
    id: b.id ?? Number(gameId),
    state: b.gameState ?? null,
    final: FINAL.has(b.gameState),
    away: side('awayTeam'),
    home: side('homeTeam'),
  };
}

module.exports = { getScores, getBox };
