'use strict';
// Loaders: fetch from the NHL APIs (through the cache) and trim to the fields the app uses.
// Field names follow the community reference https://github.com/Zmalski/NHL-API-Reference.
// Anything the NHL might omit is read defensively and comes back as null.

const { getJson, derived, TTL } = require('./cache');
const { HttpError, currentSeasonId, dflt, num, mapLimit } = require('./util');

const WEB = process.env.NHL_WEB_BASE || 'https://api-web.nhle.com/v1';
const STATS = process.env.NHL_STATS_BASE || 'https://api.nhle.com/stats/rest/en';

const ttlFor = (season) => (season === currentSeasonId() ? TTL.current : TTL.past);
const statsUrl = (report, season, gameType, extra = '') => {
  const exp = encodeURIComponent(`seasonId=${season} and gameTypeId=${gameType}${extra}`);
  return `${STATS}/${report}?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=${exp}`;
};
const splitTeams = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);

// ---------- seasons ----------
async function getSeasons() {
  const d = await getJson(`${WEB}/standings-season`, TTL.seasons);
  return (d.seasons || []).map((s) => ({
    id: String(s.id), standingsStart: s.standingsStart, standingsEnd: s.standingsEnd,
  }));
}

// ---------- standings ----------
async function getStandings(season) {
  let segment = 'now';
  if (season !== currentSeasonId()) {
    const s = (await getSeasons()).find((x) => x.id === season);
    if (!s) throw new HttpError(404, `Unknown season ${season}`);
    const end = String(s.standingsEnd || '').slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    segment = end && end < today ? end : 'now';
  }
  const d = await getJson(`${WEB}/standings/${segment}`, ttlFor(season));
  return (d.standings || []).map((t) => ({
    abbrev: dflt(t.teamAbbrev),
    // Prefer the full name; place + nickname is a fallback (the feed can shorten places, e.g. "NY").
    name: dflt(t.teamName) || `${dflt(t.placeName) || ''} ${dflt(t.teamCommonName) || ''}`.trim(),
    logo: t.teamLogo,
    conference: t.conferenceName,
    division: t.divisionName,
    gp: t.gamesPlayed,
    wins: t.wins,
    losses: t.losses,
    otLosses: t.otLosses,
    points: t.points,
    pointPct: t.pointPctg,
    regWins: t.regulationWins,
    regOtWins: t.regulationPlusOtWins,
    gf: t.goalFor,
    ga: t.goalAgainst,
    goalDiff: t.goalDifferential,
    home: { w: t.homeWins, l: t.homeLosses, otl: t.homeOtLosses },
    road: { w: t.roadWins, l: t.roadLosses, otl: t.roadOtLosses },
    l10: { w: t.l10Wins, l: t.l10Losses, otl: t.l10OtLosses },
    streak: t.streakCode ? `${t.streakCode}${t.streakCount}` : null,
    rank: { league: t.leagueSequence, conference: t.conferenceSequence, division: t.divisionSequence },
  }));
}

// ---------- skaters ----------
// Summary report (scoring) merged with the realtime report (hits, blocks, giveaways,
// takeaways). The realtime report is optional: if it fails, those fields are null.
async function getSkaters(season, gameType) {
  const ttl = ttlFor(season);
  const [summary, realtime] = await Promise.all([
    getJson(statsUrl('skater/summary', season, gameType), ttl),
    getJson(statsUrl('skater/realtime', season, gameType), ttl).catch(() => null),
  ]);
  const rt = new Map((realtime?.data || []).map((r) => [r.playerId, r]));
  return (summary.data || []).map((p) => {
    const r = rt.get(p.playerId) || {};
    return {
      id: p.playerId,
      name: p.skaterFullName,
      teams: splitTeams(p.teamAbbrevs),
      pos: p.positionCode,
      shoots: p.shootsCatches ?? null,
      gp: p.gamesPlayed,
      goals: p.goals,
      assists: p.assists,
      points: p.points,
      shots: p.shots,
      shootingPct: num(p.shootingPct),
      plusMinus: p.plusMinus,
      pim: p.penaltyMinutes,
      toiPerGame: num(p.timeOnIcePerGame),
      pointsPerGame: num(p.pointsPerGame),
      evGoals: num(p.evGoals),
      evPoints: num(p.evPoints),
      ppGoals: num(p.ppGoals),
      ppPoints: num(p.ppPoints),
      shGoals: num(p.shGoals),
      gwg: p.gameWinningGoals,
      otGoals: num(p.otGoals),
      faceoffPct: num(p.faceoffWinPct),
      hits: num(r.hits),
      blocks: num(r.blockedShots),
      giveaways: num(r.giveaways),
      takeaways: num(r.takeaways),
    };
  });
}

// ---------- goalies ----------
async function getGoalies(season, gameType) {
  const d = await getJson(statsUrl('goalie/summary', season, gameType), ttlFor(season));
  return (d.data || []).map((g) => ({
    id: g.playerId,
    name: g.goalieFullName,
    teams: splitTeams(g.teamAbbrevs),
    catches: g.shootsCatches ?? null,
    gp: g.gamesPlayed,
    gs: num(g.gamesStarted),
    wins: num(g.wins),
    losses: num(g.losses),
    otLosses: num(g.otLosses),
    shutouts: num(g.shutouts),
    savePct: num(g.savePct),
    gaa: num(g.goalsAgainstAverage),
    saves: num(g.saves),
    shotsAgainst: num(g.shotsAgainst),
    goalsAgainst: num(g.goalsAgainst),
    toi: num(g.timeOnIce),
  }));
}

// ---------- team stats (shots, special teams) ----------
// The stats report identifies teams by numeric id and full name, while standings use
// abbreviations. The NHL's own team list (id -> abbreviation) links the two exactly;
// matching by name is only a fallback, because the feeds don't always spell names the
// same way (standings can shorten "New York" to "NY").
const normName = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

async function getTeamIds() {
  const d = await getJson(`${STATS}/team`, TTL.past).catch(() => null);
  return new Map((d?.data || []).filter((t) => t.id && t.triCode).map((t) => [t.id, t.triCode]));
}

async function getTeamStats(season, gameType) {
  const [d, standings, ids] = await Promise.all([
    getJson(statsUrl('team/summary', season, gameType), ttlFor(season)),
    getStandings(season).catch(() => []),
    getTeamIds(),
  ]);
  const byAbbrev = new Map(standings.map((t) => [t.abbrev, t]));
  const byName = new Map(standings.map((t) => [normName(t.name), t]));
  // Last resort: match on the nickname alone ("Rangers"), which is unique in the league.
  const byNickname = new Map(standings.map((t) => [normName(t.name.split(' ').slice(-1)[0]), t]));
  return (d.data || []).map((t) => {
    const match = byAbbrev.get(ids.get(t.teamId))
      ?? byName.get(normName(t.teamFullName))
      ?? byNickname.get(normName(String(t.teamFullName || '').split(' ').slice(-1)[0]));
    const gp = t.gamesPlayed || 0;
    const sf = num(t.shotsForPerGame) != null ? t.shotsForPerGame * gp : null;
    const sa = num(t.shotsAgainstPerGame) != null ? t.shotsAgainstPerGame * gp : null;
    const gf = num(t.goalsFor) ?? (num(t.goalsForPerGame) != null ? t.goalsForPerGame * gp : null);
    const ga = num(t.goalsAgainst) ?? (num(t.goalsAgainstPerGame) != null ? t.goalsAgainstPerGame * gp : null);
    const shPct = sf ? gf / sf : null;
    const svPct = sa ? 1 - ga / sa : null;
    return {
      abbrev: match?.abbrev ?? null,
      teamId: t.teamId,
      name: t.teamFullName,
      logo: match?.logo ?? null,
      gp,
      goalsForPerGame: num(t.goalsForPerGame),
      goalsAgainstPerGame: num(t.goalsAgainstPerGame),
      shotsForPerGame: num(t.shotsForPerGame),
      shotsAgainstPerGame: num(t.shotsAgainstPerGame),
      shotShare: sf != null && sa != null && sf + sa ? sf / (sf + sa) : null,
      shootingPct: shPct,
      savePct: svPct,
      pdo: shPct != null && svPct != null ? shPct + svPct : null,
      powerPlayPct: num(t.powerPlayPct),
      penaltyKillPct: num(t.penaltyKillPct),
      faceoffPct: num(t.faceoffWinPct),
      pointPct: num(t.pointPct),
    };
  });
}

// ---------- player profile + bio ----------
function ageOn(birthDate, on = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let a = on.getFullYear() - b.getFullYear();
  if (on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())) a--;
  return a;
}

async function getPlayer(id) {
  const d = await getJson(`${WEB}/player/${id}/landing`, TTL.player);
  const isGoalie = d.position === 'G';
  const nhl = (d.seasonTotals || []).filter((s) => s.leagueAbbrev === 'NHL');
  const draft = d.draftDetails;
  const place = [dflt(d.birthCity), dflt(d.birthStateProvince), d.birthCountry].filter(Boolean).join(', ');

  const seasonRow = (s) => isGoalie
    ? {
        season: String(s.season), gameType: s.gameTypeId, team: dflt(s.teamName), gp: s.gamesPlayed,
        wins: num(s.wins), losses: num(s.losses), otLosses: num(s.otLosses), savePct: num(s.savePctg),
        gaa: num(s.goalsAgainstAvg), shutouts: num(s.shutouts),
      }
    : {
        season: String(s.season), gameType: s.gameTypeId, team: dflt(s.teamName), gp: s.gamesPlayed,
        goals: s.goals, assists: s.assists, points: s.points, shots: num(s.shots),
        plusMinus: num(s.plusMinus), pim: num(s.pim), ppGoals: num(s.powerPlayGoals), ppPoints: num(s.powerPlayPoints),
        gwg: num(s.gameWinningGoals), shootingPct: num(s.shootingPctg), avgToi: s.avgToi ?? null,
      };

  return {
    id: d.playerId,
    name: `${dflt(d.firstName) || ''} ${dflt(d.lastName) || ''}`.trim(),
    firstName: dflt(d.firstName) || null,
    lastName: dflt(d.lastName) || null,
    team: d.currentTeamAbbrev ?? null,
    teamName: dflt(d.fullTeamName) ?? null,
    teamLogo: d.teamLogo ?? null,
    pos: d.position,
    number: d.sweaterNumber ?? null,
    active: d.isActive ?? null,
    headshot: d.headshot ?? null,
    heroImage: d.heroImage ?? null,
    bio: {
      birthDate: d.birthDate ?? null,
      age: ageOn(d.birthDate),
      birthPlace: place || null,
      country: d.birthCountry ?? null,
      heightIn: num(d.heightInInches),
      heightCm: num(d.heightInCentimeters),
      weightLb: num(d.weightInPounds),
      weightKg: num(d.weightInKilograms),
      shoots: d.shootsCatches ?? null,
      draft: draft ? {
        year: draft.year, team: draft.teamAbbrev, round: draft.round,
        pick: draft.pickInRound, overall: draft.overallPick,
      } : null,
    },
    featured: d.featuredStats || null,
    career: d.careerTotals || null,
    seasons: nhl.filter((s) => s.gameTypeId === 2).map(seasonRow),
    playoffs: nhl.filter((s) => s.gameTypeId === 3).map(seasonRow),
    awards: (d.awards || []).map((a) => ({
      name: dflt(a.trophy),
      seasons: (a.seasons || []).map((s) => String(s.seasonId)),
    })),
    last5: d.last5Games || [],
  };
}

async function getGameLog(id, season, gameType) {
  const d = await getJson(`${WEB}/player/${id}/game-log/${season}/${gameType}`, ttlFor(season));
  return (d.gameLog || []).map((g) => ({
    gameId: g.gameId ?? null,
    date: g.gameDate, opp: g.opponentAbbrev, homeRoad: g.homeRoadFlag,
    goals: g.goals, assists: g.assists, points: g.points, shots: g.shots,
    plusMinus: g.plusMinus, pim: g.pim, toi: g.toi,
    // goalie game logs
    decision: g.decision ?? null, savePct: num(g.savePctg), shotsAgainst: num(g.shotsAgainst),
    goalsAgainst: num(g.goalsAgainst),
  }));
}

// ---------- schedules and results ----------
const FINAL = new Set(['OFF', 'FINAL']);

async function getSchedule(team, season) {
  const d = await getJson(`${WEB}/club-schedule-season/${team}/${season}`, ttlFor(season));
  let points = 0;
  let n = 0;
  return (d.games || [])
    .filter((g) => g.gameType === 2 || g.gameType === 3)
    .map((g) => {
      const home = g.homeTeam?.abbrev === team;
      const us = home ? g.homeTeam : g.awayTeam;
      const them = home ? g.awayTeam : g.homeTeam;
      const final = FINAL.has(g.gameState);
      const lastPeriod = g.gameOutcome?.lastPeriodType ?? g.periodDescriptor?.periodType ?? null;
      let result = null;
      if (final && num(us?.score) != null && num(them?.score) != null) {
        if (us.score > them.score) result = 'W';
        else result = lastPeriod === 'OT' || lastPeriod === 'SO' ? 'OTL' : 'L';
      }
      const row = {
        id: g.id,
        date: g.gameDate,
        gameType: g.gameType,
        state: g.gameState,
        home,
        opp: them?.abbrev ?? null,
        oppLogo: them?.logo ?? null,
        gf: final ? num(us?.score) : null,
        ga: final ? num(them?.score) : null,
        result,
        decidedIn: final ? lastPeriod : null,
        gameNumber: null,
        points: null,
      };
      if (g.gameType === 2 && result) {
        n += 1;
        points += result === 'W' ? 2 : result === 'OTL' ? 1 : 0;
        row.gameNumber = n;
        row.points = points;
      }
      return row;
    });
}

/** Cumulative points by game number for every team: the data behind pace/race and bump charts. */
async function getRace(season) {
  return derived(`race:v1:${season}`, async () => {
    const teams = await getStandings(season);
    const rows = await mapLimit(teams, 6, async (t) => {
      const games = await getSchedule(t.abbrev, season).catch(() => []);
      const played = games.filter((g) => g.gameNumber);
      return {
        abbrev: t.abbrev,
        name: t.name,
        logo: t.logo,
        conference: t.conference,
        division: t.division,
        games: played.map((g) => ({ n: g.gameNumber, date: g.date, result: g.result, points: g.points, gf: g.gf, ga: g.ga })),
      };
    });
    return { data: { season, teams: rows }, ttl: ttlFor(season) };
  });
}

// ---------- percentiles ----------
// Each skater is ranked against the same position group (forwards or defense) with a
// minimum games-played threshold, so small samples don't dominate the extremes.

const METRICS = [
  { key: 'pointsPer60', label: 'Points per 60', better: 'high' },
  { key: 'goalsPer60', label: 'Goals per 60', better: 'high' },
  { key: 'assistsPer60', label: 'Assists per 60', better: 'high' },
  { key: 'shotsPer60', label: 'Shots per 60', better: 'high' },
  { key: 'shootingPct', label: 'Shooting %', better: 'high', minShots: 20 },
  { key: 'toiPerGame', label: 'Time on ice per game', better: 'high' },
  { key: 'ppPointsPerGame', label: 'Power-play points per game', better: 'high' },
  { key: 'plusMinusPerGame', label: 'Plus/minus per game', better: 'high' },
  { key: 'hitsPer60', label: 'Hits per 60', better: 'high' },
  { key: 'blocksPer60', label: 'Blocked shots per 60', better: 'high' },
  { key: 'takeawaysPer60', label: 'Takeaways per 60', better: 'high' },
];

const group = (pos) => (pos === 'D' ? 'D' : 'F');

function rates(p) {
  const toi = p.toiPerGame && p.gp ? (p.toiPerGame * p.gp) / 3600 : null; // hours
  const per60 = (v) => (toi && v != null ? v / toi : null);
  return {
    pointsPer60: per60(p.points),
    goalsPer60: per60(p.goals),
    assistsPer60: per60(p.assists),
    shotsPer60: per60(p.shots),
    shootingPct: p.shots >= 20 ? p.shootingPct : null,
    toiPerGame: p.toiPerGame,
    ppPointsPerGame: p.gp && p.ppPoints != null ? p.ppPoints / p.gp : null,
    plusMinusPerGame: p.gp ? p.plusMinus / p.gp : null,
    hitsPer60: per60(p.hits),
    blocksPer60: per60(p.blocks),
    takeawaysPer60: per60(p.takeaways),
  };
}

/** Percentile of v within a sorted array: share below plus half the ties, 0-100. */
function percentileOf(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
  let eq = lo;
  while (eq < sorted.length && sorted[eq] === v) eq++;
  // Shown as 1-99 ("99th percentile" is the top), the usual convention for ranks.
  return Math.min(99, Math.max(1, Math.round(((lo + (eq - lo) / 2) / sorted.length) * 100)));
}

async function getPercentiles(season, gameType) {
  return derived(`pct:v2:${season}:${gameType}`, async () => {
    const skaters = await getSkaters(season, gameType);
    const maxGp = Math.max(0, ...skaters.map((p) => p.gp));
    const minGp = Math.max(1, Math.min(20, Math.ceil(maxGp * 0.25)));

    const rows = skaters.map((p) => ({ p, g: group(p.pos), r: rates(p), eligible: p.gp >= minGp }));
    const dist = {};
    for (const g of ['F', 'D']) {
      dist[g] = {};
      for (const m of METRICS) {
        dist[g][m.key] = rows
          .filter((x) => x.g === g && x.eligible && x.r[m.key] != null)
          .map((x) => x.r[m.key])
          .sort((a, b) => a - b);
      }
    }
    const players = {};
    for (const x of rows) {
      const pct = {};
      for (const m of METRICS) {
        const v = x.r[m.key];
        const d = dist[x.g][m.key];
        pct[m.key] = x.eligible && v != null && d.length ? percentileOf(d, v) : null;
      }
      players[x.p.id] = { id: x.p.id, name: x.p.name, group: x.g, eligible: x.eligible, values: x.r, pct };
    }
    const poolSize = { F: rows.filter((x) => x.g === 'F' && x.eligible).length, D: rows.filter((x) => x.g === 'D' && x.eligible).length };
    return { data: { season, gameType, minGp, poolSize, metrics: METRICS, players }, ttl: ttlFor(season) };
  });
}

module.exports = {
  WEB, STATS, ttlFor,
  getSeasons, getStandings, getSkaters, getGoalies, getTeamStats,
  getPlayer, getGameLog, getSchedule, getRace, getPercentiles,
};
