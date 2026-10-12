import { Outlet, Route, Routes } from 'react-router';
import { SeasonProvider } from './lib/season';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { ComingSoon, NotFound } from './pages/ComingSoon';

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
          <Route path="teams" element={<ComingSoon section="teams" />} />
          <Route path="teams/:abbrev" element={<ComingSoon section="teams" />} />
          <Route path="players" element={<ComingSoon section="players" />} />
          <Route path="players/:id" element={<ComingSoon section="players" />} />
          <Route path="compare" element={<ComingSoon section="compare" />} />
          <Route path="games" element={<ComingSoon section="games" />} />
          <Route path="goalies" element={<ComingSoon section="goalies" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
