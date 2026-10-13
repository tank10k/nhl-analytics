import { useApi } from '../lib/api';
import { useSeason } from '../lib/season';
import { seasonLabel } from '../lib/format';
import type { SkatersResponse, StandingsResponse, Team, Skater } from '../lib/types';
import { ErrorNotice, Panel, Skeleton } from '../components/Panel';
import { StrengthQuadrant } from './home/StrengthQuadrant';
import { Leaders } from './home/Leaders';
import { DivisionTables } from './home/DivisionTables';
import { TodayStrip } from './games/GamesPage';

function Lede({ teams, players, isCurrent }: { teams: Team[]; players?: Skater[]; isCurrent: boolean }) {
  const played = teams.filter((t) => t.gp > 0);
  if (!played.length) {
    return <p className="page-lede">No games have been played yet this season. Standings and leaders fill in after opening night.</p>;
  }
  const best = [...played].sort((a, b) => b.points - a.points || b.pointPct - a.pointPct)[0];
  const scorer = players?.length ? [...players].sort((a, b) => b.points - a.points || a.gp - b.gp)[0] : undefined;
  const verb = isCurrent ? 'lead' : 'finished first in';
  return (
    <p className="page-lede">
      The <strong>{best.name}</strong> {verb} the league with <strong>{best.points} points</strong> in {best.gp} games.
      {scorer && (
        <> <strong>{scorer.name}</strong> {isCurrent ? 'tops' : 'topped'} the scoring race with <strong>{scorer.points} points</strong>.</>
      )}
    </p>
  );
}

export function Home() {
  const { season, isCurrent } = useSeason();
  const standings = useApi<StandingsResponse>(`/api/standings?season=${season}`);
  const skaters = useApi<SkatersResponse>(`/api/skaters?season=${season}&limit=2000`);
  const teams = standings.data?.teams;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">League overview<span className="season">{seasonLabel(season)}</span></h1>
        {teams
          ? <Lede teams={teams} players={skaters.data?.players} isCurrent={isCurrent} />
          : !standings.error && <Skeleton height={22} width="min(560px, 90%)" style={{ marginTop: 12 }} />}
      </header>

      {isCurrent && <TodayStrip />}

      {standings.error && <ErrorNotice error={standings.error} onRetry={standings.retry} />}

      {!standings.error && (
        <>
          <div className="grid-hero">
            <Panel
              title="Team strength"
              sub="Goals scored and allowed per game. Dashed lines mark the league average; click a team to open it."
            >
              {teams ? <StrengthQuadrant teams={teams} /> : <Skeleton height={440} />}
            </Panel>
            {skaters.error
              ? <ErrorNotice error={skaters.error} onRetry={skaters.retry} />
              : <Leaders players={skaters.data?.players} loading={skaters.loading} />}
          </div>

          <div className="section-head">
            <h2>Standings</h2>
            <p>By division, ordered by points</p>
          </div>
          {teams ? <DivisionTables teams={teams} /> : (
            <div className="grid-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={360} />)}</div>
          )}
        </>
      )}
    </>
  );
}
