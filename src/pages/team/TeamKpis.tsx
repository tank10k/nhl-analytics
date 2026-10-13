import { fmtPct, ordinal } from '../../lib/format';
import { rankOf } from '../../lib/stats';
import type { TeamStats } from '../../lib/types';

type Key = 'goalsForPerGame' | 'goalsAgainstPerGame' | 'shotShare' | 'powerPlayPct' | 'penaltyKillPct' | 'pdo';
const KPIS: { key: Key; label: string; fmt: (v: number) => string; low?: boolean; note: string }[] = [
  { key: 'goalsForPerGame', label: 'Goals for / game', fmt: (v) => v.toFixed(2), note: 'Scoring' },
  { key: 'goalsAgainstPerGame', label: 'Goals against / game', fmt: (v) => v.toFixed(2), low: true, note: 'Keeping it out' },
  { key: 'shotShare', label: 'Shot share', fmt: (v) => fmtPct(v), note: 'Share of shots on goal' },
  { key: 'powerPlayPct', label: 'Power play', fmt: (v) => fmtPct(v), note: 'Goals per advantage' },
  { key: 'penaltyKillPct', label: 'Penalty kill', fmt: (v) => fmtPct(v), note: 'Kills per shorthanded spell' },
  { key: 'pdo', label: 'PDO', fmt: (v) => (v * 1000).toFixed(0), note: 'Shooting % + save %' },
];

/** Six headline numbers, each with its league rank so the value has context. */
export function TeamKpis({ team, all }: { team: TeamStats; all: TeamStats[] }) {
  return (
    <div className="kpi-row">
      {KPIS.map((k) => {
        const v = team[k.key];
        const vals = all.map((t) => t[k.key]).filter((x): x is number => x != null);
        const rank = v != null ? rankOf(vals, v, !k.low) : null;
        // PDO is about luck, not quality, so it gets no "rank".
        const showRank = rank != null && k.key !== 'pdo';
        return (
          <div className="kpi" key={k.key}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{v != null ? k.fmt(v) : '–'}</span>
            <span className="kpi-note">
              {showRank ? <><b>{ordinal(rank)}</b> of {vals.length}</> : k.key === 'pdo' && v != null
                ? (v > 1.015 ? 'Running hot: likely to cool' : v < 0.985 ? 'Running cold: likely to improve' : 'Around normal luck')
                : k.note}
            </span>
          </div>
        );
      })}
    </div>
  );
}
