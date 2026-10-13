import { useMemo, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { hemColors, inkOn, mix, teamAccent, teamColors } from '../../lib/teams';
import { seasonLabel } from '../../lib/format';
import type { PercentilesTable } from '../../lib/stats';
import type { GoaliesResponse, RaceResponse, ScheduleResponse, SkatersResponse, StandingsResponse, TeamStatsResponse } from '../../lib/types';
import { ErrorNotice, Panel, Skeleton } from '../../components/Panel';
import { PlayerCardLoader, percentileMap } from '../../components/PlayerCardLoader';
import { PointsRace } from '../../charts/PointsRace';
import { TeamHero } from './TeamHero';
import { TeamKpis } from './TeamKpis';
import { ResultsStrip, RollingForm } from './TeamCharts';
import { RosterTables, ScheduleLists, Splits } from './TeamTables';
import { TeamShots } from './TeamShots';
import { usePageTitle } from '../../lib/title';

export function TeamPage() {
  const { abbrev = '' } = useParams();
  const code = abbrev.toUpperCase();
  const { season, link } = useSeason();

  const standings = useApi<StandingsResponse>(`/api/standings?season=${season}`);
  const stats = useApi<TeamStatsResponse>(`/api/teams/stats?season=${season}`);
  const schedule = useApi<ScheduleResponse>(`/api/team/${code}/schedule?season=${season}`);
  const race = useApi<RaceResponse>(`/api/league/race?season=${season}`);
  const skaters = useApi<SkatersResponse>(`/api/skaters?season=${season}&team=${code}&limit=200`);
  const goalies = useApi<GoaliesResponse>(`/api/goalies?season=${season}&team=${code}&sort=gp`);
  const pctAll = useApi<PercentilesTable>(`/api/percentiles?season=${season}`);

  const team = standings.data?.teams.find((t) => t.abbrev === code);
  usePageTitle(team?.name ?? code);
  const teamStats = stats.data?.teams.find((t) => t.abbrev === code);
  const accent = teamAccent(code);

  // Page-wide theme: every accent on this page takes the team's color.
  const { primary } = teamColors(code);
  const [hem1, hem2] = hemColors(code);
  const theme = {
    '--team-primary': primary,
    '--team-deep': mix(primary, '#050b16', 0.6),
    '--team-ink': inkOn(primary),
    '--team-accent': accent,
    '--hem-1': hem1,
    '--hem-2': hem2,
  } as CSSProperties;

  const pct = useMemo(() => percentileMap(pctAll.data, season), [pctAll.data, season]);
  // Current roster: players whose latest team this season is this one.
  const roster = useMemo(
    () => (skaters.data?.players ?? []).filter((p) => p.teams[p.teams.length - 1] === code).sort((a, b) => b.points - a.points),
    [skaters.data, code],
  );
  const topIds = roster.slice(0, 4).map((p) => p.id);

  const raceTeam = race.data?.teams.find((t) => t.abbrev === code);
  const divTeams = race.data?.teams.filter((t) => t.division === raceTeam?.division) ?? [];
  const confTeams = race.data?.teams.filter((t) => t.conference === raceTeam?.conference) ?? [];

  if (standings.data && !team) {
    return (
      <>
        <header className="page-head"><h1 className="page-title">Team not found</h1></header>
        <div className="notice notice-quiet"><p>No team “{code}” played in {seasonLabel(season)}. <Link to={link('/teams')}>See all teams</Link>.</p></div>
      </>
    );
  }

  return (
    <div className="team-page" style={theme}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to={link('/teams')}>Teams</Link><span aria-hidden>/</span><span>{team?.name ?? code}</span>
        {team && <Link className="crumb-action" to={link(`/compare?teams=${code}`)}>Compare with others</Link>}
      </nav>

      {standings.error && <ErrorNotice error={standings.error} onRetry={standings.retry} />}
      {team ? <TeamHero team={team} season={season} /> : <Skeleton height={200} style={{ borderRadius: 14 }} />}

      {teamStats && stats.data ? <TeamKpis team={teamStats} all={stats.data.teams} /> : !stats.error && <Skeleton height={96} style={{ margin: '16px 0' }} />}

      <div className="team-grid">
        <Panel
          className="span-2"
          title="Points pace"
          sub={`${team?.division ?? ''} Division. The dashed line is the 8th-best total in the ${team?.conference ?? ''} Conference after each game, roughly the last playoff spot.`}
        >
          {race.data && raceTeam ? <PointsRace teams={divTeams} cutTeams={confTeams} focus={code} height={380} />
            : race.error ? <ErrorNotice error={race.error} onRetry={race.retry} /> : <Skeleton height={380} />}
        </Panel>

        <Panel title="Every game" sub="Goal differential by game. Lighter bars went to overtime or a shootout.">
          {schedule.data ? <ResultsStrip games={schedule.data.games} /> : <Skeleton height={220} />}
        </Panel>
        <Panel title="Recent form" sub="Rolling goals for and against per game">
          {schedule.data ? <RollingForm games={schedule.data.games} accent={accent} /> : <Skeleton height={260} />}
        </Panel>

        {team && <TeamShots team={code} season={season} accent={accent} />}

        <Panel title="Splits" sub="Where and how the points come">
          {schedule.data ? <Splits games={schedule.data.games} /> : <Skeleton height={220} />}
        </Panel>
        <Panel title="Schedule">
          {schedule.data ? <ScheduleLists games={schedule.data.games} /> : <Skeleton height={220} />}
          {schedule.error && <ErrorNotice error={schedule.error} onRetry={schedule.retry} />}
        </Panel>
      </div>

      <div className="section-head"><h2>Roster</h2><p>Leading scorers, then everyone who has played for {code} this season</p></div>
      {skaters.error && <ErrorNotice error={skaters.error} onRetry={skaters.retry} />}
      <div className="card-row">
        {skaters.data
          ? topIds.map((id) => <PlayerCardLoader key={`${id}-${season}`} id={id} season={season} pct={pct.get(id)} />)
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} height={430} style={{ borderRadius: 14 }} />)}
      </div>
      <Panel title="All players" className="roster-panel">
        {skaters.data ? <RosterTables skaters={roster} goalies={(goalies.data?.goalies ?? []).filter((g) => g.teams[g.teams.length - 1] === code)} />
          : <Skeleton height={400} />}
      </Panel>
    </div>
  );
}
