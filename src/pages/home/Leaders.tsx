import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Panel, Segmented, SkeletonRows } from '../../components/Panel';
import { TeamStripe } from '../../components/TeamChip';
import { teamAccent } from '../../lib/teams';
import { fmtDec } from '../../lib/format';
import { useSeason } from '../../lib/season';
import type { Skater } from '../../lib/types';

type Stat = 'points' | 'goals' | 'assists' | 'pointsPerGame';

const STATS: { value: Stat; label: string; title: string }[] = [
  { value: 'points', label: 'Points', title: 'points' },
  { value: 'goals', label: 'Goals', title: 'goals' },
  { value: 'assists', label: 'Assists', title: 'assists' },
  { value: 'pointsPerGame', label: 'P/GP', title: 'points per game' },
];

/** Points per game needs a minimum sample, scaled to how far into the season we are. */
function minGames(players: Skater[]) {
  const maxGp = Math.max(0, ...players.map((p) => p.gp));
  return Math.max(1, Math.round(maxGp * 0.4));
}

export function Leaders({ players, loading }: { players?: Skater[]; loading: boolean }) {
  const [stat, setStat] = useState<Stat>('points');
  const { link } = useSeason();

  const rows = useMemo(() => {
    if (!players) return [];
    const pool = stat === 'pointsPerGame' ? players.filter((p) => p.gp >= minGames(players)) : players;
    const sorted = [...pool].sort((a, b) => b[stat] - a[stat] || b.points - a.points || a.gp - b.gp).slice(0, 10);
    // competition ranking: ties share a rank
    let rank = 0;
    return sorted.map((p, i) => {
      if (i === 0 || p[stat] !== sorted[i - 1][stat]) rank = i + 1;
      return { p, rank };
    });
  }, [players, stat]);

  const top = rows[0]?.p[stat] || 1;
  const fmt = (v: number) => (stat === 'pointsPerGame' ? fmtDec(v) : String(v));
  const meta = STATS.find((s) => s.value === stat)!;

  return (
    <Panel
      title="Scoring leaders"
      sub={stat === 'pointsPerGame' && players ? `Minimum ${minGames(players)} games played` : 'Regular season, skaters'}
      tools={<Segmented label="Leader stat" value={stat} options={STATS} onChange={setStat} />}
    >
      {loading && !players ? <SkeletonRows rows={10} height={30} /> : rows.length === 0 ? (
        <p className="empty">No games played yet this season.</p>
      ) : (
        <ol className="leaders" aria-label={`Top 10 in ${meta.title}`}>
          {rows.map(({ p, rank }) => {
            const team = p.teams[p.teams.length - 1];
            return (
              <li key={p.id} className="leader">
                <span className="leader-rank">{rank}</span>
                <TeamStripe abbrev={team} height={30} />
                <div className="leader-main">
                  <Link to={link(`/players/${p.id}`)} className="leader-name">{p.name}</Link>
                  <span className="leader-meta">{p.teams.join('/')} · {p.gp} GP</span>
                  <span className="leader-bar" aria-hidden>
                    <span style={{ width: `${(p[stat] / top) * 100}%`, background: teamAccent(team) }} />
                  </span>
                </div>
                <span className="leader-val">{fmt(p[stat])}</span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
