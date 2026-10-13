import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { useApi } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { fmtPct, fmtPct3, fmtSigned, recordStr, seasonLabel } from '../../lib/format';
import { teamAccent } from '../../lib/teams';
import type { RaceResponse, StandingsResponse, Team, TeamStats, TeamStatsResponse } from '../../lib/types';
import { ErrorNotice, Panel, Segmented, Skeleton } from '../../components/Panel';
import { TeamLogo } from '../../components/TeamChip';
import { PointsRace } from '../../charts/PointsRace';

const DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];
const divOrder = (d: string) => { const i = DIVISION_ORDER.indexOf(d); return i === -1 ? 99 : i; };

function TeamTile({ t }: { t: Team }) {
  const { link } = useSeason();
  return (
    <Link to={link(`/teams/${t.abbrev}`)} className="team-tile" style={{ '--tile-accent': teamAccent(t.abbrev) } as CSSProperties}>
      <TeamLogo src={t.logo} size={40} />
      <span className="tt-main">
        <span className="tt-name">{t.name}</span>
        <span className="tt-meta">{recordStr(t.wins, t.losses, t.otLosses)} · L10 {recordStr(t.l10.w, t.l10.l, t.l10.otl)}{t.streak ? ` · ${t.streak}` : ''}</span>
      </span>
      <span className="tt-pts"><b>{t.points}</b><small>pts</small></span>
    </Link>
  );
}

type SortKey = keyof Pick<TeamStats, 'pointPct' | 'goalsForPerGame' | 'goalsAgainstPerGame' | 'shotsForPerGame'
  | 'shotsAgainstPerGame' | 'shotShare' | 'shootingPct' | 'savePct' | 'pdo' | 'powerPlayPct' | 'penaltyKillPct' | 'faceoffPct'>;

const COLS: { key: SortKey; label: string; title: string; fmt: (v: number | null) => string; low?: boolean }[] = [
  { key: 'pointPct', label: 'P%', title: 'Points percentage', fmt: fmtPct3 },
  { key: 'goalsForPerGame', label: 'GF/GP', title: 'Goals for per game', fmt: (v) => (v == null ? '–' : v.toFixed(2)) },
  { key: 'goalsAgainstPerGame', label: 'GA/GP', title: 'Goals against per game (lower is better)', fmt: (v) => (v == null ? '–' : v.toFixed(2)), low: true },
  { key: 'shotsForPerGame', label: 'SF/GP', title: 'Shots for per game', fmt: (v) => (v == null ? '–' : v.toFixed(1)) },
  { key: 'shotsAgainstPerGame', label: 'SA/GP', title: 'Shots against per game (lower is better)', fmt: (v) => (v == null ? '–' : v.toFixed(1)), low: true },
  { key: 'shotShare', label: 'Shot share', title: "Share of the game's shots on goal taken by this team", fmt: (v) => fmtPct(v) },
  { key: 'shootingPct', label: 'SH%', title: 'Shooting percentage', fmt: (v) => fmtPct(v) },
  { key: 'savePct', label: 'SV%', title: 'Save percentage', fmt: (v) => (v == null ? '–' : v.toFixed(3).replace(/^0/, '')) },
  { key: 'pdo', label: 'PDO', title: 'Shooting % + save %. Far above 1.000 often means luck that tends to even out.', fmt: (v) => (v == null ? '–' : (v * 1000).toFixed(0)) },
  { key: 'powerPlayPct', label: 'PP%', title: 'Power-play percentage', fmt: (v) => fmtPct(v) },
  { key: 'penaltyKillPct', label: 'PK%', title: 'Penalty-kill percentage', fmt: (v) => fmtPct(v) },
  { key: 'faceoffPct', label: 'FO%', title: 'Faceoff win percentage', fmt: (v) => fmtPct(v) },
];

function TeamStatsTable({ stats, standings }: { stats: TeamStats[]; standings: Team[] }) {
  const { link } = useSeason();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'pointPct', dir: -1 });
  const byAbbrev = new Map(standings.map((t) => [t.abbrev, t]));
  const rows = [...stats].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (av == null) return 1;
    if (bv == null) return -1;
    return sort.dir * (av - bv);
  });
  const onSort = (c: (typeof COLS)[number]) =>
    setSort((s) => (s.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.low ? 1 : -1 }));

  return (
    <div className="table-scroll">
      <table className="table sortable">
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col" title="Goal differential">Diff</th>
            {COLS.map((c) => (
              <th key={c.key} scope="col" title={c.title} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                <button type="button" onClick={() => onSort(c)}>
                  {c.label}{sort.key === c.key && <span aria-hidden>{sort.dir === -1 ? ' ↓' : ' ↑'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const st = t.abbrev ? byAbbrev.get(t.abbrev) : undefined;
            return (
              <tr key={t.teamId}>
                <td>
                  {t.abbrev ? (
                    <Link to={link(`/teams/${t.abbrev}`)} className="team-chip team-row-link">
                      <span className="team-stripe" style={{ background: teamAccent(t.abbrev) }} />
                      <TeamLogo src={t.logo ?? undefined} size={22} />
                      <span className="team-abbr">{t.abbrev}</span>
                    </Link>
                  ) : t.name}
                </td>
                <td>{st ? fmtSigned(st.goalDiff) : '–'}</td>
                {COLS.map((c) => (
                  <td key={c.key} className={sort.key === c.key ? 'sorted' : undefined}>{c.fmt(t[c.key])}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TeamsPage() {
  const { season } = useSeason();
  const standings = useApi<StandingsResponse>(`/api/standings?season=${season}`);
  const stats = useApi<TeamStatsResponse>(`/api/teams/stats?season=${season}`);
  const race = useApi<RaceResponse>(`/api/league/race?season=${season}`);

  const teams = standings.data?.teams ?? [];
  const divisions = useMemo(() => {
    const by = new Map<string, Team[]>();
    for (const t of teams) by.set(t.division, [...(by.get(t.division) ?? []), t]);
    return [...by.entries()]
      .sort(([a], [b]) => divOrder(a) - divOrder(b) || a.localeCompare(b))
      .map(([name, list]) => ({ name, conference: list[0].conference, teams: list.sort((a, b) => a.rank.division - b.rank.division) }));
  }, [teams]);

  const [raceDiv, setRaceDiv] = useState<string>('');
  const activeDiv = raceDiv || divisions[0]?.name || '';
  const raceTeams = race.data?.teams.filter((t) => t.division === activeDiv) ?? [];
  const confTeams = race.data?.teams.filter((t) => t.conference === raceTeams[0]?.conference) ?? [];

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Teams<span className="season">{seasonLabel(season)}</span></h1>
        <p className="page-lede">Every club at a glance. Open a team for its pace, form, splits and roster.</p>
      </header>

      {standings.error && <ErrorNotice error={standings.error} onRetry={standings.retry} />}

      {!standings.error && (
        <>
          <div className="division-grid">
            {standings.data ? divisions.map((d) => (
              <section key={d.name} className="division-col" aria-label={`${d.name} Division`}>
                <h2 className="division-title">{d.name}<small>{d.conference}</small></h2>
                <div className="tile-list">{d.teams.map((t) => <TeamTile key={t.abbrev} t={t} />)}</div>
              </section>
            )) : [0, 1, 2, 3].map((i) => <Skeleton key={i} height={540} />)}
          </div>

          <Panel
            title="Points race"
            sub="Running points by game number. The dashed line is the conference's 8th-best total at each game, roughly where the last playoff spot sits."
            tools={divisions.length > 0 && (
              <Segmented label="Division" value={activeDiv} onChange={setRaceDiv}
                options={divisions.map((d) => ({ value: d.name, label: d.name }))} />
            )}
          >
            {race.error ? <ErrorNotice error={race.error} onRetry={race.retry} />
              : race.data ? <PointsRace teams={raceTeams} cutTeams={confTeams} />
              : <><Skeleton height={420} /><p className="table-note">Loading all 32 schedules. The first load of a season takes a few seconds.</p></>}
          </Panel>

          <div className="section-head"><h2>Team stats</h2><p>Shots, finishing, goaltending and special teams. Select a column to sort.</p></div>
          <Panel title="Underlying numbers" sub="Shot share above 50% means a team outshoots its opponents. PDO near 1000 is normal; far from it usually evens out.">
            {stats.error ? <ErrorNotice error={stats.error} onRetry={stats.retry} />
              : stats.data ? <TeamStatsTable stats={stats.data.teams} standings={teams} />
              : <Skeleton height={600} />}
          </Panel>
        </>
      )}
    </>
  );
}
