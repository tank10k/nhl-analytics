import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { useApi } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { fmtPct, fmtPct3, fmtSigned, ordinal, recordStr } from '../../lib/format';
import type { RaceResponse, ScheduleResponse, StandingsResponse, Team, TeamStats, TeamStatsResponse } from '../../lib/types';
import { Radar } from '../../charts/Radar';
import { PointsRace } from '../../charts/PointsRace';
import { ErrorNotice, Panel, Skeleton } from '../../components/Panel';
import { TeamLogo } from '../../components/TeamChip';
import { SLOT_COLORS, SLOT_HEX, TeamPicker } from './Pickers';

type StatKey = 'pointPct' | 'goalsForPerGame' | 'goalsAgainstPerGame' | 'shotShare' | 'shootingPct' | 'savePct' | 'powerPlayPct' | 'penaltyKillPct' | 'faceoffPct';
const AXES: { key: StatKey; label: string; low?: boolean; fmt: (v: number | null) => string }[] = [
  { key: 'pointPct', label: 'Points %', fmt: fmtPct3 },
  { key: 'goalsForPerGame', label: 'Goals for', fmt: (v) => (v == null ? '–' : v.toFixed(2)) },
  { key: 'goalsAgainstPerGame', label: 'Goals against', low: true, fmt: (v) => (v == null ? '–' : v.toFixed(2)) },
  { key: 'shotShare', label: 'Shot share', fmt: (v) => fmtPct(v) },
  { key: 'shootingPct', label: 'Shooting %', fmt: (v) => fmtPct(v) },
  { key: 'savePct', label: 'Save %', fmt: (v) => (v == null ? '–' : v.toFixed(3).replace(/^0/, '')) },
  { key: 'powerPlayPct', label: 'Power play', fmt: (v) => fmtPct(v) },
  { key: 'penaltyKillPct', label: 'Penalty kill', fmt: (v) => fmtPct(v) },
  { key: 'faceoffPct', label: 'Faceoffs', fmt: (v) => fmtPct(v) },
];

/** League standing on a 0-100 scale: 100 = best of the 32, 0 = worst. */
function leagueScore(all: TeamStats[], key: StatKey, value: number | null, low = false): number | null {
  if (value == null) return null;
  const vals = all.map((t) => t[key]).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const better = vals.filter((v) => (low ? v < value : v > value)).length;
  return Math.round((1 - better / (vals.length - 1)) * 100);
}

interface Row { label: string; get: (t: Team, s?: TeamStats) => number | null; fmt: (v: number | null, t: Team) => string; low?: boolean; noBest?: boolean }
const ROWS: Row[] = [
  { label: 'Record', get: () => null, fmt: (_v, t) => recordStr(t.wins, t.losses, t.otLosses), noBest: true },
  { label: 'Points', get: (t) => t.points, fmt: (v) => String(v ?? '–') },
  { label: 'Points %', get: (t) => t.pointPct, fmt: (v) => fmtPct3(v) },
  { label: 'League rank', get: (t) => t.rank.league, fmt: (v) => (v == null ? '–' : ordinal(v)), low: true },
  { label: 'Goal differential', get: (t) => t.goalDiff, fmt: (v) => fmtSigned(v) },
  { label: 'Goals for per game', get: (_t, s) => s?.goalsForPerGame ?? null, fmt: (v) => (v == null ? '–' : v.toFixed(2)) },
  { label: 'Goals against per game', get: (_t, s) => s?.goalsAgainstPerGame ?? null, fmt: (v) => (v == null ? '–' : v.toFixed(2)), low: true },
  { label: 'Shot share', get: (_t, s) => s?.shotShare ?? null, fmt: (v) => fmtPct(v) },
  { label: 'PDO', get: (_t, s) => (s?.pdo != null ? s.pdo * 1000 : null), fmt: (v) => (v == null ? '–' : v.toFixed(0)), noBest: true },
  { label: 'Power play', get: (_t, s) => s?.powerPlayPct ?? null, fmt: (v) => fmtPct(v) },
  { label: 'Penalty kill', get: (_t, s) => s?.penaltyKillPct ?? null, fmt: (v) => fmtPct(v) },
  { label: 'Faceoffs', get: (_t, s) => s?.faceoffPct ?? null, fmt: (v) => fmtPct(v) },
  { label: 'Home', get: (t) => (t.home.w * 2 + t.home.otl) / Math.max(1, (t.home.w + t.home.l + t.home.otl) * 2), fmt: (_v, t) => recordStr(t.home.w, t.home.l, t.home.otl) },
  { label: 'Road', get: (t) => (t.road.w * 2 + t.road.otl) / Math.max(1, (t.road.w + t.road.l + t.road.otl) * 2), fmt: (_v, t) => recordStr(t.road.w, t.road.l, t.road.otl) },
  { label: 'Last 10', get: (t) => t.l10.w * 2 + t.l10.otl, fmt: (_v, t) => recordStr(t.l10.w, t.l10.l, t.l10.otl) },
  { label: 'Streak', get: () => null, fmt: (_v, t) => t.streak ?? '–', noBest: true },
];

/** Games between the first two teams this season, from the first team's schedule. */
function SeasonSeries({ a, b, season }: { a: string; b: string; season: string }) {
  const sched = useApi<ScheduleResponse>(`/api/team/${a}/schedule?season=${season}`);
  if (!sched.data) return <Skeleton height={120} />;
  const games = sched.data.games.filter((g) => g.opp === b);
  if (!games.length) return <p className="empty">{a} and {b} don't meet this season.</p>;
  const played = games.filter((g) => g.result);
  const aw = played.filter((g) => g.result === 'W').length;
  const bw = played.length - aw;
  const dateFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <>
      <p className="series-sum">
        {played.length === 0 ? `${games.length} game${games.length === 1 ? '' : 's'} scheduled, none played yet.`
          : aw === bw ? `Series tied ${aw}–${bw}` : `${aw > bw ? a : b} leads the series ${Math.max(aw, bw)}–${Math.min(aw, bw)}`}
        {played.length > 0 && games.length > played.length && `, ${games.length - played.length} still to play`}
      </p>
      <ul className="sched-list series-list">
        {games.map((g) => (
          <li key={g.id} className="sched-row">
            <span className="sched-date">{dateFmt(g.date)}</span>
            <span className="sched-ha">{g.home ? `${b} @ ${a}` : `${a} @ ${b}`}</span>
            <span />
            {g.result
              ? <span className="sched-res" style={{ borderLeftColor: g.result === 'W' ? SLOT_COLORS[0] : SLOT_COLORS[1] }}><b>{g.result === 'W' ? a : b}</b> {Math.max(g.gf ?? 0, g.ga ?? 0)}–{Math.min(g.gf ?? 0, g.ga ?? 0)}{g.decidedIn && g.decidedIn !== 'REG' ? ` (${g.decidedIn})` : ''}</span>
              : <span className="sched-res muted">Upcoming</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function CompareTeams({ abbrevs, onChange }: { abbrevs: string[]; onChange: (a: string[]) => void }) {
  const { season, link } = useSeason();
  const standings = useApi<StandingsResponse>(`/api/standings?season=${season}`);
  const stats = useApi<TeamStatsResponse>(`/api/teams/stats?season=${season}`);
  const race = useApi<RaceResponse>(abbrevs.length ? `/api/league/race?season=${season}` : null);

  const all = standings.data?.teams ?? [];
  const byAbbrev = useMemo(() => new Map(all.map((t) => [t.abbrev, t])), [all]);
  const statsBy = useMemo(() => new Map((stats.data?.teams ?? []).map((t) => [t.abbrev, t])), [stats.data]);
  const chosen = abbrevs.map((a) => byAbbrev.get(a)).filter((t): t is Team => Boolean(t));
  const colors = useMemo(() => Object.fromEntries(abbrevs.map((a, i) => [a, SLOT_HEX[i]])), [abbrevs]);

  if (standings.error) return <ErrorNotice error={standings.error} onRetry={standings.retry} />;

  const top3 = [...all].sort((a, b) => a.rank.league - b.rank.league).slice(0, 3).map((t) => t.abbrev);

  return (
    <>
      <div className="cmp-bar">
        {standings.data
          ? <TeamPicker all={all} selected={abbrevs} onAdd={(a) => onChange([...abbrevs, a])} onRemove={(a) => onChange(abbrevs.filter((x) => x !== a))} />
          : <Skeleton height={44} />}
      </div>

      {abbrevs.length === 0 && (
        <div className="cmp-empty">
          <p>Choose a team above, or start with the top three in the league.</p>
          {top3.length === 3 && <button type="button" className="btn btn-primary" onClick={() => onChange(top3)}>Compare the top three teams</button>}
        </div>
      )}

      {chosen.length > 0 && (
        <>
          <div className="cmp-team-tiles" style={{ gridTemplateColumns: `repeat(${chosen.length}, minmax(0, 1fr))` }}>
            {chosen.map((t, i) => (
              <Link key={t.abbrev} to={link(`/teams/${t.abbrev}`)} className="cmp-team-tile" style={{ '--slot': SLOT_COLORS[i] } as CSSProperties}>
                <TeamLogo src={t.logo} size={56} />
                <span>
                  <b>{t.name}</b>
                  <small>{recordStr(t.wins, t.losses, t.otLosses)} · {ordinal(t.rank.division)} in {t.division}</small>
                </span>
                <span className="cmp-team-pts"><b>{t.points}</b><small>pts</small></span>
              </Link>
            ))}
          </div>

          <div className="grid-2 cmp-grid">
            <Panel title="League standing by area" sub="Each spoke places the team among all 32: the rim is the league's best, the center its worst, the brighter ring the middle.">
              {stats.data ? (
                <Radar
                  axes={AXES.map((a) => a.label)}
                  series={chosen.map((t, i) => {
                    const s = statsBy.get(t.abbrev);
                    return {
                      name: t.abbrev,
                      color: SLOT_HEX[i],
                      values: AXES.map((a) => leagueScore(stats.data!.teams, a.key, s?.[a.key] ?? null, a.low)),
                      detail: AXES.map((a) => a.fmt(s?.[a.key] ?? null)),
                    };
                  })}
                  ariaLabel="Radar chart of league standing by area for the selected teams"
                />
              ) : stats.error ? <ErrorNotice error={stats.error} onRetry={stats.retry} /> : <Skeleton height={420} />}
            </Panel>
            <Panel title="Points race" sub="Running points by game number">
              {race.data ? (
                <PointsRace teams={race.data.teams.filter((t) => abbrevs.includes(t.abbrev))} colors={colors} height={420} />
              ) : race.error ? <ErrorNotice error={race.error} onRetry={race.retry} /> : <Skeleton height={420} />}
            </Panel>
          </div>

          <div className={chosen.length === 2 ? 'grid-2 cmp-grid' : 'cmp-grid'}>
            <Panel title="Head to head" sub="This season. ▲ marks the leader in each row." className="cmp-table-panel">
              <div className="table-scroll">
                <table className="table cmp-table">
                  <thead>
                    <tr>
                      <th scope="col">Stat</th>
                      {chosen.map((t, i) => (
                        <th key={t.abbrev} scope="col" style={{ '--slot': SLOT_COLORS[i] } as CSSProperties}>
                          <span className="cmp-th"><i aria-hidden />{t.abbrev}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((r) => {
                      const vals = chosen.map((t) => r.get(t, statsBy.get(t.abbrev)));
                      const nums = vals.filter((v): v is number => v != null);
                      const best = !r.noBest && nums.length > 1 ? (r.low ? Math.min(...nums) : Math.max(...nums)) : null;
                      const unique = best != null && nums.filter((v) => v === best).length === 1;
                      return (
                        <tr key={r.label}>
                          <th scope="row">{r.label}</th>
                          {chosen.map((t, i) => (
                            <td key={t.abbrev} className={unique && vals[i] === best ? 'cmp-best' : undefined}>
                              {r.fmt(vals[i], t)}{unique && vals[i] === best && <span className="cmp-mark" aria-label="leader"> ▲</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
            {chosen.length === 2 && (
              <Panel title="Season series" sub={`Every meeting between ${chosen[0].abbrev} and ${chosen[1].abbrev} this season`}>
                <SeasonSeries a={chosen[0].abbrev} b={chosen[1].abbrev} season={season} />
              </Panel>
            )}
          </div>
        </>
      )}
    </>
  );
}
