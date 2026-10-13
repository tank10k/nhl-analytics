import { useEffect } from 'react';
import { Link } from 'react-router';
import { gameStatus } from '../../lib/games';
import { useSeason } from '../../lib/season';
import { teamAccent } from '../../lib/teams';
import type { GameSummary, GameTeam } from '../../lib/types';
import { TeamLogo } from '../../components/TeamChip';

/** Re-run `refresh` every `ms` while `active` (live games), and stop when it isn't. */
export function useAutoRefresh(active: boolean, refresh: () => void, ms = 30000) {
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [active, refresh, ms]);
}

function Row({ t, lead, started }: { t: GameTeam; lead: boolean; started: boolean }) {
  return (
    <span className={`st-row${lead ? ' st-lead' : ''}`}>
      <span className="team-stripe" style={{ background: teamAccent(t.abbrev), height: 22 }} />
      <TeamLogo src={t.logo ?? undefined} size={28} />
      <span className="st-abbr">{t.abbrev}</span>
      <span className="st-name">{t.name}</span>
      {started && t.sog != null && <span className="st-sog" title="Shots on goal">{t.sog} SOG</span>}
      <span className="st-score">{started ? t.score ?? 0 : ''}</span>
    </span>
  );
}

/** One game on the scoreboard: away over home, status line, live marker. */
export function ScoreTile({ g, compact = false }: { g: GameSummary; compact?: boolean }) {
  const { link } = useSeason();
  const started = g.live || g.final;
  const as = g.away.score ?? 0, hs = g.home.score ?? 0;
  return (
    <Link to={link(`/games/${g.id}`)} className={`score-tile${g.live ? ' is-live' : ''}${compact ? ' compact' : ''}`}>
      <span className="st-status">
        {g.live && <span className="live-dot" aria-hidden />}
        <span>{g.live ? 'Live · ' : ''}{gameStatus(g)}</span>
      </span>
      <Row t={g.away} lead={g.final && as > hs} started={started} />
      <Row t={g.home} lead={g.final && hs > as} started={started} />
    </Link>
  );
}
