import { Outlet, Route, Routes } from 'react-router';
import { SeasonProvider } from './lib/season';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { PlayersPage } from './pages/players/PlayersPage';
import { PlayerPage } from './pages/player/PlayerPage';
import { TeamsPage } from './pages/teams/TeamsPage';
import { TeamPage } from './pages/team/TeamPage';
import { ComparePage } from './pages/compare/ComparePage';
import { GamesPage } from './pages/games/GamesPage';
import { GamePage } from './pages/game/GamePage';
import { GoaliesPage } from './pages/goalies/GoaliesPage';

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
          <Route path="compare" element={<ComparePage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="games/:id" element={<GamePage />} />
          <Route path="goalies" element={<GoaliesPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
