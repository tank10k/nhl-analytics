import { useMemo } from 'react';
import { useApi } from '../../lib/api';
import type { PlayerShotsResponse } from '../../lib/types';
import { ShotMap } from '../../charts/ShotMap';
import { ErrorNotice, Panel, Skeleton } from '../../components/Panel';

/** A skater's shot attempts this season on the half-rink, with goals vs. expected goals. */
export function PlayerShots({ playerId, season, accent }: { playerId: number; season: string; accent: string }) {
  const res = useApi<PlayerShotsResponse>(`/api/player/${playerId}/shots?season=${season}`);
  const d = res.data;
  const shots = useMemo(() => (d ? d.shots.map(([x, y, xg, kind, strength]) => ({ x, y, xg, kind, strength })) : []), [d]);
  const gax = d?.summary.goalsAboveExpected ?? 0;

  return (
    <Panel
      title="Shot map"
      sub={d
        ? `${d.summary.attempts} attempts in ${d.gamesLoaded} games. ${d.summary.goals} goals from ${d.summary.xg.toFixed(1)} expected: ${gax >= 0 ? 'finishing above' : 'finishing below'} the quality of chances by ${Math.abs(gax).toFixed(1)}.`
        : 'Every shot attempt this season, placed on the rink'}
    >
      {res.error ? <ErrorNotice error={res.error} onRetry={res.retry} />
        : !d ? (
          <>
            <Skeleton height={420} />
            <p className="table-note">Reading this player's games. The first load of a season can take a little while.</p>
          </>
        ) : d.shots.length === 0 ? <p className="empty">No shot attempts this season yet.</p>
        : <ShotMap shots={shots} accent={accent} label="Player shot map" />}
    </Panel>
  );
}
