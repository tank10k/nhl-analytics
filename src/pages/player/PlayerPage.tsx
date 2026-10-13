import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { buildCard, seasonTotals } from '../../lib/cards';
import { ordinal, seasonLabel } from '../../lib/format';
import type { GameLogEntry, Player, PlayerPercentiles } from '../../lib/types';
import { ErrorNotice, Skeleton } from '../../components/Panel';
import { PlayerCard } from '../../components/PlayerCard';
import { PercentilePanel } from './PercentilePanel';
import { SeasonPace } from './SeasonPace';
import { FormChart } from './FormChart';
import { CareerChart } from './CareerChart';
import { GameLogTable } from './GameLogTable';

function Lede({ player, season, pct }: { player: Player; season: string; pct?: PlayerPercentiles }) {
  const s = seasonTotals(player.seasons, season);
  if (!s || !s.gp) {
    return <p className="page-lede">{player.name} hasn't played an NHL game in {seasonLabel(season)}.</p>;
  }
  if (player.pos === 'G') {
    return (
      <p className="page-lede">
        <strong>{s.wins ?? 0} wins</strong> in {s.gp} games, with a <strong>{s.savePct != null ? s.savePct.toFixed(3).replace(/^0/, '') : '–'}</strong> save percentage.
      </p>
    );
  }
  const rate = pct?.eligible ? pct.pct.pointsPer60 : null;
  const group = pct?.group === 'D' ? 'defensemen' : 'forwards';
  return (
    <p className="page-lede">
      <strong>{s.points} points</strong> ({s.goals} goals, {s.assists} assists) in {s.gp} games.
      {rate != null && rate >= 60 && <> Scores at a rate in the <strong>{ordinal(rate)} percentile</strong> of {group}.</>}
      {rate != null && rate < 60 && <> Scoring rate ranks in the {ordinal(rate)} percentile of {group}.</>}
    </p>
  );
}

export function PlayerPage() {
  const { id } = useParams();
  const { season, link } = useSeason();
  const player = useApi<Player>(`/api/player/${id}`);
  const isGoalie = player.data?.pos === 'G';
  const pct = useApi<PlayerPercentiles>(player.data && !isGoalie ? `/api/player/${id}/percentiles?season=${season}` : null);
  const log = useApi<{ games: GameLogEntry[] }>(`/api/player/${id}/gamelog?season=${season}`);

  const card = useMemo(
    () => (player.data ? buildCard(player.data, season, { percentiles: pct.data, games: log.data?.games }) : null),
    [player.data, season, pct.data, log.data],
  );

  const pastSeasons = useMemo(() => {
    if (!player.data) return [];
    return [...new Set(player.data.seasons.map((s) => s.season))].filter((s) => s < season).sort().reverse();
  }, [player.data, season]);

  if (player.error) {
    return (
      <>
        <header className="page-head"><h1 className="page-title">Player</h1></header>
        {player.error.status === 404
          ? <div className="notice" role="alert"><p>No NHL player has the id {id}. Search with Ctrl+K to find who you're looking for.</p></div>
          : <ErrorNotice error={player.error} onRetry={player.retry} />}
      </>
    );
  }

  const p = player.data;
  const games = log.data?.games ?? [];

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to={link('/players')}>Players</Link>
        <span aria-hidden>/</span>
        <span>{p?.name ?? 'Loading'}</span>
      </nav>
      <header className="page-head">
        <h1 className="page-title">{p?.name ?? <Skeleton height={40} width={320} />}<span className="season">{seasonLabel(season)}</span></h1>
        {p ? <Lede player={p} season={season} pct={pct.data} /> : <Skeleton height={22} width="min(520px, 90%)" style={{ marginTop: 12 }} />}
      </header>

      <div className="player-layout">
        <div className="player-card-col">
          {card ? <PlayerCard card={card} /> : <Skeleton height={640} width={380} style={{ borderRadius: 14 }} />}
        </div>
        <div className="player-main">
          {p && !isGoalie && pct.data && <PercentilePanel data={pct.data} />}
          {p && !isGoalie && pct.error?.status === 404 && (
            <div className="notice notice-quiet"><p>No skater stats for {seasonLabel(season)}, so there are no percentile ranks to show.</p></div>
          )}
          {p && !isGoalie && (log.data
            ? <SeasonPace key={`${id}-${season}`} playerId={p.id} season={season} games={games} pastSeasons={pastSeasons} />
            : <Skeleton height={380} />)}
          {log.data ? <FormChart games={games} goalie={isGoalie} /> : <Skeleton height={340} />}
          {p && <CareerChart player={p} season={season} />}
          {log.error && <ErrorNotice error={log.error} onRetry={log.retry} />}
          {log.data && <GameLogTable games={games} goalie={isGoalie} />}
        </div>
      </div>
    </>
  );
}
