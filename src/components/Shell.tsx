import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useSeason } from '../lib/season';
import { seasonLabel } from '../lib/format';
import { CommandPalette, usePaletteHotkey } from './CommandPalette';
import { IconCompare, IconGames, IconGoalies, IconLeague, IconPlayers, IconSearch, IconTeams } from './Icons';

const NAV = [
  { to: '/', label: 'League', icon: IconLeague, end: true },
  { to: '/teams', label: 'Teams', icon: IconTeams },
  { to: '/players', label: 'Players', icon: IconPlayers },
  { to: '/compare', label: 'Compare', icon: IconCompare },
  { to: '/games', label: 'Games', icon: IconGames },
  { to: '/goalies', label: 'Goalies', icon: IconGoalies },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Shell() {
  const { season, seasons, setSeason, link } = useSeason();
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteHotkey(setPaletteOpen);
  const { pathname } = useLocation();

  // A new page starts at the top. Changing only the query (season, date, compare
  // picks) keeps the scroll position.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to={link('/')} className="brand" aria-label="NHL Analytics home">
          <span className="brand-mark" aria-hidden><span /><span /><span /></span>
          <span className="brand-name">NHL Analytics<small>Teams, players and trends</small></span>
        </NavLink>
        <nav className="nav" aria-label="Sections">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={link(to)} end={end} className={({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon />
              {label}
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
          <div className="page-enter" key={pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
