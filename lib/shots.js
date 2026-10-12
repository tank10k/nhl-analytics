'use strict';
// Shots from the NHL play-by-play, normalized onto one half-rink, plus a simple
// expected-goals (xG) model.
//
// Rink coordinates: x runs -100..100 (feet from center), y -42.5..42.5, nets at x = ±89.
// Every shot is flipped so the attacking net is at x = +89; a shot map then needs
// only the offensive half.
//
// The xG model is a hand-set logistic curve on distance, angle, shot type, rebounds
// and empty nets. It is in the same spirit as public hockey xG models, but it is not
// fitted to data, so treat values as approximate: good for comparing players and
// teams, not as a precise probability.

const { getJson, derived, TTL } = require('./cache');
const { getSchedule, getGameLog, WEB, ttlFor } = require('./loaders');
const { HttpError, mmssToSec, mapLimit, num } = require('./util');

const NET_X = 89;
const MODEL_VERSION = 'xg1';

const KIND = { 'goal': 'goal', 'shot-on-goal': 'shot', 'missed-shot': 'miss', 'blocked-shot': 'block' };

const TYPE_ADJ = {
  'wrist': 0, 'snap': 0.05, 'slap': -0.1, 'backhand': -0.15,
  'tip-in': 0.25, 'deflected': 0.2, 'wrap-around': -0.3, 'bat': 0, 'poke': -0.2,
  'between-legs': 0.1, 'cradle': 0.1,
};

/** Probability an unblocked shot becomes a goal. Blocked shots get no xG. */
function xg(s) {
  if (s.kind === 'block') return 0;
  if (s.emptyNet) return s.dist < 90 ? 0.9 - s.dist * 0.004 : 0.5;
  let logit = -0.6 - 0.065 * s.dist - 0.012 * Math.abs(s.angle);
  logit += TYPE_ADJ[s.type] ?? 0;
  if (s.rebound) logit += 0.8;
  if (s.strength === 'PP') logit += 0.15;
  return 1 / (1 + Math.exp(-logit));
}

/**
 * situationCode is four digits: away goalie (1/0), away skaters, home skaters, home goalie.
 * Returns the shooting team's strength state.
 */
function strengthOf(code, shooterIsHome) {
  if (!/^\d{4}$/.test(String(code || ''))) return { strength: 'EV', emptyNet: false };
  const [ag, as, hs, hg] = String(code).split('').map(Number);
  const [own, opp, oppGoalie] = shooterIsHome ? [hs, as, ag] : [as, hs, hg];
  const emptyNet = oppGoalie === 0;
  let strength = 'EV';
  if (own > opp) strength = 'PP';
  else if (own < opp) strength = 'SH';
  else if (own === 5) strength = '5v5';
  return { strength, emptyNet };
}

/** Parse one game's play-by-play into normalized shot features (no xG yet). */
function parseShots(pbp) {
  const homeId = pbp.homeTeam?.id;
  const homeAbbrev = pbp.homeTeam?.abbrev;
  const awayAbbrev = pbp.awayTeam?.abbrev;
  const raw = [];
  // The roster tells us each shooter's team for certain. It matters for blocked shots,
  // where the event can be credited to the blocking team.
  const teamOf = new Map((pbp.rosterSpots || []).map((r) => [r.playerId, r.teamId]));

  for (const p of pbp.plays || []) {
    const kind = KIND[p.typeDescKey];
    if (!kind) continue;
    const d = p.details || {};
    if (num(d.xCoord) == null || num(d.yCoord) == null) continue;
    const shooterId = kind === 'goal' ? d.scoringPlayerId : d.shootingPlayerId;
    const rosterTeam = teamOf.get(shooterId);
    const shooterIsHome = rosterTeam != null
      ? rosterTeam === homeId
      : kind === 'block' ? d.eventOwnerTeamId !== homeId : d.eventOwnerTeamId === homeId;
    const period = p.periodDescriptor?.number ?? null;
    raw.push({
      p, d, kind, period, shooterIsHome,
      sec: mmssToSec(p.timeInPeriod),
      x: d.xCoord, y: d.yCoord,
    });
  }

  // Which way does each team attack in each period? Prefer the feed's own flag;
  // fall back to where most of that team's shots were taken that period.
  const sideGuess = new Map();
  for (const r of raw) {
    const k = `${r.period}:${r.shooterIsHome}`;
    sideGuess.set(k, (sideGuess.get(k) || 0) + Math.sign(r.x));
  }

  const shots = [];
  let prev = null;
  for (const r of raw) {
    const flag = r.p.homeTeamDefendingSide; // 'left' => home goalie at x<0 => home attacks +x
    let attacksPositive;
    if (flag === 'left' || flag === 'right') {
      const homeAttacksPositive = flag === 'left';
      attacksPositive = r.shooterIsHome ? homeAttacksPositive : !homeAttacksPositive;
    } else {
      attacksPositive = (sideGuess.get(`${r.period}:${r.shooterIsHome}`) || 0) >= 0;
    }
    const x = attacksPositive ? r.x : -r.x;
    const y = attacksPositive ? r.y : -r.y;
    const dx = NET_X - x;
    const dist = Math.hypot(dx, y);
    const angle = (Math.atan2(y, Math.max(dx, 0.1)) * 180) / Math.PI;
    const { strength, emptyNet } = strengthOf(r.p.situationCode, r.shooterIsHome);
    const shooter = r.kind === 'goal' ? r.d.scoringPlayerId : r.d.shootingPlayerId;
    const team = r.shooterIsHome ? homeAbbrev : awayAbbrev;
    // Rebound: same team shot again within 3 seconds, same period.
    const rebound = Boolean(prev && prev.team === team && prev.period === r.period
      && r.sec != null && prev.sec != null && r.sec - prev.sec <= 3 && r.sec >= prev.sec);
    const s = {
      team,
      shooter: shooter ?? null,
      goalie: r.d.goalieInNetId ?? null,
      kind: r.kind,
      type: r.d.shotType ?? null,
      period: r.period,
      sec: r.sec,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      dist: Math.round(dist * 10) / 10,
      angle: Math.round(angle),
      strength,
      emptyNet,
      rebound,
    };
    shots.push(s);
    prev = s;
  }
  return shots;
}

const withXg = (shots) => shots.map((s) => ({ ...s, xg: Math.round(xg(s) * 1000) / 1000 }));

/** Shots for one game. Finished games are cached permanently (only the parsed shots). */
async function getGameShots(gameId) {
  if (!/^\d{10}$/.test(String(gameId))) throw new HttpError(400, 'game id must be 10 digits, e.g. 2025020001');
  const parsed = await derived(`shots:v1:${gameId}`, async () => {
    const pbp = await getJson(`${WEB}/gamecenter/${gameId}/play-by-play`, TTL.live, { persist: false });
    const final = pbp.gameState === 'OFF' || pbp.gameState === 'FINAL';
    return {
      data: {
        game: {
          id: pbp.id,
          season: String(pbp.season ?? ''),
          gameType: pbp.gameType ?? null,
          date: pbp.gameDate ?? null,
          state: pbp.gameState ?? null,
          home: { abbrev: pbp.homeTeam?.abbrev ?? null, score: num(pbp.homeTeam?.score), logo: pbp.homeTeam?.logo ?? null },
          away: { abbrev: pbp.awayTeam?.abbrev ?? null, score: num(pbp.awayTeam?.score), logo: pbp.awayTeam?.logo ?? null },
        },
        shots: parseShots(pbp),
      },
      ttl: final ? Infinity : TTL.live,
    };
  });
  return { model: MODEL_VERSION, game: parsed.game, shots: withXg(parsed.shots) };
}

/** Totals for a list of shots: attempts (Corsi), unblocked (Fenwick), on goal, goals, xG. */
function totals(shots) {
  const t = { attempts: 0, unblocked: 0, onGoal: 0, goals: 0, xg: 0 };
  for (const s of shots) {
    t.attempts++;
    if (s.kind !== 'block') t.unblocked++;
    if (s.kind === 'shot' || s.kind === 'goal') t.onGoal++;
    if (s.kind === 'goal') t.goals++;
    t.xg += s.xg;
  }
  t.xg = Math.round(t.xg * 100) / 100;
  return t;
}

function share(a, b) {
  return a + b ? Math.round((a / (a + b)) * 1000) / 1000 : null;
}

function summarize(forShots, againstShots) {
  const f = totals(forShots), a = totals(againstShots);
  const f5 = totals(forShots.filter((s) => s.strength === '5v5'));
  const a5 = totals(againstShots.filter((s) => s.strength === '5v5'));
  return {
    all: { for: f, against: a, corsiPct: share(f.attempts, a.attempts), fenwickPct: share(f.unblocked, a.unblocked), xgPct: share(f.xg, a.xg) },
    fiveOnFive: { for: f5, against: a5, corsiPct: share(f5.attempts, a5.attempts), fenwickPct: share(f5.unblocked, a5.unblocked), xgPct: share(f5.xg, a5.xg) },
  };
}

// Compact shot rows for season-long maps: [x, y, xg, kind, strength, period, gameIndex]
const compact = (s, gi) => [s.x, s.y, s.xg, s.kind, s.strength, s.period, gi];

/** All shots for and against a team over a season (completed games only). */
async function getTeamShots(team, season, gameType = '2') {
  const games = (await getSchedule(team, season))
    .filter((g) => String(g.gameType) === String(gameType) && g.result);
  const per = await mapLimit(games, 4, (g) => getGameShots(g.id).catch(() => null));
  const forShots = [], againstShots = [], gameRows = [];
  per.forEach((gs, i) => {
    if (!gs) return;
    const g = games[i];
    const f = gs.shots.filter((s) => s.team === team);
    const a = gs.shots.filter((s) => s.team !== team);
    forShots.push(...f.map((s) => compact(s, gameRows.length)));
    againstShots.push(...a.map((s) => compact(s, gameRows.length)));
    const tf = totals(f), ta = totals(a);
    gameRows.push({
      id: g.id, date: g.date, opp: g.opp, home: g.home, result: g.result, gf: g.gf, ga: g.ga,
      xgFor: tf.xg, xgAgainst: ta.xg, attemptsFor: tf.attempts, attemptsAgainst: ta.attempts,
    });
  });
  const expand = (rows) => rows.map(([x, y, xgv, kind, strength]) => ({ x, y, xg: xgv, kind, strength }));
  return {
    team, season, gameType, model: MODEL_VERSION,
    gamesRequested: games.length,
    gamesLoaded: gameRows.length,
    summary: summarize(expand(forShots), expand(againstShots)),
    games: gameRows,
    columns: ['x', 'y', 'xg', 'kind', 'strength', 'period', 'game'],
    for: forShots,
    against: againstShots,
  };
}

/** All of one skater's shot attempts in a season, via their game log. */
async function getPlayerShots(id, season, gameType = '2') {
  const log = await getGameLog(id, season, gameType);
  const ids = log.map((g) => g.gameId).filter(Boolean);
  const per = await mapLimit(ids, 4, (gid) => getGameShots(gid).catch(() => null));
  const mine = [];
  const gameRows = [];
  per.forEach((gs, i) => {
    if (!gs) return;
    const s = gs.shots.filter((x) => x.shooter === Number(id));
    const t = totals(s);
    gameRows.push({ id: ids[i], date: gs.game.date, attempts: t.attempts, goals: t.goals, xg: t.xg });
    mine.push(...s.map((x) => compact(x, gameRows.length - 1)));
  });
  const expanded = mine.map(([x, y, xgv, kind, strength]) => ({ x, y, xg: xgv, kind, strength }));
  const t = totals(expanded);
  return {
    playerId: Number(id), season, gameType, model: MODEL_VERSION,
    gamesRequested: ids.length,
    gamesLoaded: gameRows.length,
    summary: { ...t, goalsAboveExpected: Math.round((t.goals - t.xg) * 100) / 100 },
    games: gameRows,
    columns: ['x', 'y', 'xg', 'kind', 'strength', 'period', 'game'],
    shots: mine,
  };
}

module.exports = { getGameShots, getTeamShots, getPlayerShots, xg, strengthOf, parseShots, MODEL_VERSION, ttlFor };
