import { Outlet, Route, Routes } from 'react-router';
import { SeasonProvider } from './lib/season';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { ComingSoon, NotFound } from './pages/ComingSoon';
import { PlayersPage } from './pages/players/PlayersPage';
import { PlayerPage } from './pages/player/PlayerPage';
import { TeamsPage } from './pages/teams/TeamsPage';
import { TeamPage } from './pages/team/TeamPage';

function Root() {
  return (
    <SeasonProvider>
      <Outlet />
    </SeasonProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Root />}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:abbrev" element={<TeamPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:id" element={<PlayerPage key="player" />} />
          <Route path="compare" element={<ComingSoon section="compare" />} />
          <Route path="games" element={<ComingSoon section="games" />} />
          <Route path="goalies" element={<ComingSoon section="goalies" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
