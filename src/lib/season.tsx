import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useApi } from './api';
import type { SeasonsResponse } from './types';

// The selected season lives in the URL (?season=20252026) so every view can be
// bookmarked and shared, and links between pages carry it along.

interface SeasonCtx {
  season: string;           // selected season id
  current: string;          // the league's current season id
  seasons: string[];        // newest first, 2005-06 onward
  isCurrent: boolean;
  setSeason: (id: string) => void;
  /** Append ?season= to an app path when a past season is selected. */
  link: (path: string) => string;
}

const Ctx = createContext<SeasonCtx | null>(null);

function guessCurrent(d = new Date()) {
  const start = d.getMonth() + 1 >= 9 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}${start + 1}`;
}

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const { data } = useApi<SeasonsResponse>('/api/seasons');

  const current = data?.current ?? guessCurrent();
  const seasons = useMemo(() => {
    const ids = new Set((data?.seasons ?? []).map((s) => s.id).filter((id) => Number(id.slice(0, 4)) >= 2005));
    ids.add(current);
    return [...ids].sort().reverse();
  }, [data, current]);

  const raw = params.get('season');
  const season = raw && /^\d{8}$/.test(raw) ? raw : current;

  const setSeason = useCallback((id: string) => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (id === current) next.delete('season');
      else next.set('season', id);
      return next;
    });
  }, [setParams, current]);

  const link = useCallback((path: string) => {
    if (season === current) return path;
    return `${path}${path.includes('?') ? '&' : '?'}season=${season}`;
  }, [season, current]);

  const value = useMemo(
    () => ({ season, current, seasons, isCurrent: season === current, setSeason, link }),
    [season, current, seasons, setSeason, link],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSeason(): SeasonCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSeason must be used inside <SeasonProvider>');
  return v;
}
