import { darkLogo } from '../../lib/teams';
import { proxied } from '../../lib/img';
import { fmtPct3, ordinal, recordStr, seasonLabel } from '../../lib/format';
import type { Team } from '../../lib/types';

/** Full-width banner in the team's colors, finished with the same hem stripes as the player cards. */
export function TeamHero({ team, season }: { team: Team; season: string }) {
  const conf = team.conference.replace(/ern$/, '');
  return (
    <header className="team-hero">
      <div className="th-inner">
        {team.logo && <img className="th-logo" src={proxied(darkLogo(team.logo))} alt="" width={112} height={112} />}
        <div className="th-title">
          <span className="th-season">{seasonLabel(season)} · {team.division} Division</span>
          <h1 className="th-name">{team.name}</h1>
          <p className="th-record">
            {recordStr(team.wins, team.losses, team.otLosses)}
            <span>{fmtPct3(team.pointPct)} points %</span>
            {team.streak && <span>Streak {team.streak}</span>}
            <span>Last 10: {recordStr(team.l10.w, team.l10.l, team.l10.otl)}</span>
          </p>
        </div>
        <dl className="th-ranks">
          <div className="th-points"><dt>Points</dt><dd>{team.points}</dd></div>
          <div><dt>{team.division}</dt><dd>{ordinal(team.rank.division)}</dd></div>
          <div><dt>{conf}</dt><dd>{ordinal(team.rank.conference)}</dd></div>
          <div><dt>League</dt><dd>{ordinal(team.rank.league)}</dd></div>
        </dl>
      </div>
      <div className="pc-hem th-hem" aria-hidden><span /><span /><span /></div>
    </header>
  );
}
