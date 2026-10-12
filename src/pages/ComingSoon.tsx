import { Link, useParams } from 'react-router';
import { useSeason } from '../lib/season';

// Placeholder for sections that later build steps fill in. Each one says what is
// coming and, where the original app already covers it, links there meanwhile.

interface Plan {
  title: string;
  step: number;
  lede: string;
  items: string[];
  legacy?: (params: Record<string, string | undefined>, season: string) => string;
}

const PLANS: Record<string, Plan> = {
  teams: {
    title: 'Teams',
    step: 4,
    lede: 'A page for every team, themed in its own colors.',
    items: [
      'Points-pace race against the playoff line',
      'Home and road splits, rolling 10-game form',
      'Roster as player cards',
      'Schedule and results',
    ],
    legacy: (_p, s) => `/legacy?season=${s}`,
  },
  players: {
    title: 'Players',
    step: 3,
    lede: 'Searchable, filterable leaderboards, and a detailed card for every player.',
    items: [
      'Player cards in team colors, with bio and percentile ranks against the same position',
      'Last-10-games sparkline and career arc',
      'Season trend lines with past-season comparison',
      'Export a card as an image',
    ],
    legacy: (p, s) => (p.id ? `/player.html?id=${p.id}&season=${s}` : `/players.html?season=${s}`),
  },
  compare: {
    title: 'Compare',
    step: 6,
    lede: 'Put two or three players or teams side by side.',
    items: ['Overlaid radar of percentile ranks', 'Shared trend lines', 'Head-to-head stat table'],
  },
  games: {
    title: 'Games',
    step: 7,
    lede: 'Scores and a closer look at each game.',
    items: ['Live scoreboard', 'Game-flow chart of shot attempts and expected goals', 'Shot map for each game'],
  },
  goalies: {
    title: 'Goalies',
    step: 8,
    lede: 'Leaderboards and cards for goaltenders.',
    items: ['Save percentage, goals against average, wins', 'Goals saved above expected', 'Goalie cards'],
  },
};

export function ComingSoon({ section }: { section: keyof typeof PLANS }) {
  const params = useParams();
  const { season } = useSeason();
  const plan = PLANS[section];
  const legacyHref = plan.legacy?.(params, season);
  const which = params.abbrev ?? (params.id ? `player ${params.id}` : null);

  return (
    <div className="soon-page">
      <header className="page-head">
        <h1 className="page-title">{plan.title}{which && <span className="season">{which}</span>}</h1>
        <p className="page-lede">{plan.lede} This section is built in step {plan.step}.</p>
      </header>
      <ul className="soon-list">
        {plan.items.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <div className="soon-actions">
        {legacyHref && <a className="btn btn-primary" href={legacyHref}>Open in the original app</a>}
        <Link className="btn" to="/">Back to league overview</Link>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="soon-page">
      <header className="page-head">
        <h1 className="page-title">Page not found</h1>
        <p className="page-lede">That address doesn't match any page in the app.</p>
      </header>
      <Link className="btn" to="/">Go to league overview</Link>
    </div>
  );
}
