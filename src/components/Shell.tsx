import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useSeason } from '../lib/season';
import { seasonLabel } from '../lib/format';
import { CommandPalette, usePaletteHotkey } from './CommandPalette';
import { IconCompare, IconGames, IconGoalies, IconLeague, IconPlayers, IconSearch, IconTeams } from './Icons';

// `step` marks sections that later build steps fill in.
const NAV = [
  { to: '/', label: 'League', icon: IconLeague, end: true },
  { to: '/teams', label: 'Teams', icon: IconTeams, step: 4 },
  { to: '/players', label: 'Players', icon: IconPlayers },
  { to: '/compare', label: 'Compare', icon: IconCompare, step: 6 },
  { to: '/games', label: 'Games', icon: IconGames, step: 7 },
  { to: '/goalies', label: 'Goalies', icon: IconGoalies, step: 8 },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Shell() {
  const { season, seasons, setSeason, link } = useSeason();
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteHotkey(setPaletteOpen);

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to={link('/')} className="brand" aria-label="NHL Analytics home">
          <span className="brand-mark" aria-hidden><span /><span /><span /></span>
          <span className="brand-name">NHL Analytics<small>Teams, players and trends</small></span>
        </NavLink>
        <nav className="nav" aria-label="Sections">
          {NAV.map(({ to, label, icon: Icon, end, step }) => (
            <NavLink key={to} to={link(to)} end={end} className={({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon />
              {label}
              {step && <span className="soon">Step {step}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          Data from the NHL's public stats feeds.{' '}
          <a href="/legacy">Original app</a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <IconSearch />
            <span>Search players and teams</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <div className="grow" />
          <label className="field">
            <span className="sr-only">Season</span>
            <select className="select" value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map((id) => <option key={id} value={id}>{seasonLabel(id)}</option>)}
            </select>
          </label>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
