import { useApi } from '../lib/api';
import { useSeason } from '../lib/season';
import { buildCard, type CardPct } from '../lib/cards';
import type { GameLogEntry, Player, PlayerPercentiles } from '../lib/types';
import { Skeleton } from './Panel';
import { PlayerCard } from './PlayerCard';

/** A compact player card that loads its own profile and recent games. */
export function PlayerCardLoader({ id, season, pct, goalieRanks }: {
  id: number; season: string; pct?: PlayerPercentiles; goalieRanks?: { pct: CardPct[]; note: string | null } | null;
}) {
  const { link } = useSeason();
  const player = useApi<Player>(`/api/player/${id}`);
  const log = useApi<{ games: GameLogEntry[] }>(`/api/player/${id}/gamelog?season=${season}`);
  if (!player.data) return <Skeleton height={430} style={{ borderRadius: 14 }} />;
  const card = buildCard(player.data, season, { percentiles: pct, games: log.data?.games, goalieRanks });
  return <PlayerCard card={card} size="compact" href={link(`/players/${id}`)} />;
}

/** Percentile rows from /api/percentiles, keyed by player id, in the shape cards expect. */
export function percentileMap(
  d: { minGp: number; poolSize: { F: number; D: number }; metrics: PlayerPercentiles['metrics']; players: PlayerPercentiles[] } | undefined,
  season: string,
): Map<number, PlayerPercentiles> {
  const m = new Map<number, PlayerPercentiles>();
  if (d) for (const p of d.players) m.set(p.id, { ...p, season, gameType: '2', minGp: d.minGp, poolSize: d.poolSize[p.group], metrics: d.metrics });
  return m;
}
