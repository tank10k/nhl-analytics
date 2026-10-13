import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApi } from '../../lib/api';
import { longDate, todayIso } from '../../lib/games';
import type { ScoresResponse } from '../../lib/types';
import { ErrorNotice, Skeleton } from '../../components/Panel';
import { ScoreTile, useAutoRefresh } from './ScoreTile';

/**
 * Scoreboard for one date (today by default). Live games come first, then upcoming,
 * then finals. While anything is live the page refreshes itself every 30 seconds.
 */
export function GamesPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? '';
  const scores = useApi<ScoresResponse>(`/api/scores${date ? `?date=${date}` : ''}`);
  useAutoRefresh(Boolean(scores.data?.anyLive), scores.retry);

  const go = (d: string | null) => {
    if (!d) return;
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (d === todayIso()) next.delete('date'); else next.set('date', d);
      return next;
    });
  };

  const ordered = useMemo(() => {
    const g = scores.data?.games ?? [];
    const rank = (x: (typeof g)[number]) => (x.live ? 0 : !x.final ? 1 : 2);
    return [...g].sort((a, b) => rank(a) - rank(b) || String(a.start).localeCompare(String(b.start)));
  }, [scores.data]);

  const d = scores.data;
  const live = ordered.filter((g) => g.live).length;
  const finals = ordered.filter((g) => g.final).length;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Games</h1>
        <p className="page-lede">
          {d ? longDate(d.date) : ' '}
          {d && d.games.length > 0 && (
            <>. {d.games.length} game{d.games.length === 1 ? '' : 's'}{live ? `, ${live} live now` : ''}{finals && finals < d.games.length ? `, ${finals} final` : ''}.</>
          )}
        </p>
      </header>

      <div className="date-nav" role="group" aria-label="Choose a date">
        <button type="button" className="btn" disabled={!d?.prevDate} onClick={() => go(d?.prevDate ?? null)}>Previous day</button>
        <label className="field">
          <span className="sr-only">Date</span>
          <input className="input date-input" type="date" value={d?.date ?? date} onChange={(e) => go(e.target.value)} />
        </label>
        <button type="button" className="btn" disabled={!d?.nextDate} onClick={() => go(d?.nextDate ?? null)}>Next day</button>
        {date && <button type="button" className="btn" onClick={() => go(todayIso())}>Today</button>}
        {d?.anyLive && <span className="refresh-note"><span className="live-dot" aria-hidden />Updates every 30 seconds</span>}
      </div>

      {scores.error && <ErrorNotice error={scores.error} onRetry={scores.retry} />}
      {!d && !scores.error && <div className="score-grid">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={118} />)}</div>}
      {d && d.games.length === 0 && (
        <div className="notice notice-quiet"><p>No NHL games on this date. Use Previous day or Next day to find the nearest slate.</p></div>
      )}
      {d && d.games.length > 0 && (
        <div className="score-grid">
          {ordered.map((g) => <ScoreTile key={g.id} g={g} />)}
        </div>
      )}
    </>
  );
}

/** Compact strip of today's games for the League overview. Hidden on days without games. */
export function TodayStrip() {
  const scores = useApi<ScoresResponse>('/api/scores');
  useAutoRefresh(Boolean(scores.data?.anyLive), scores.retry);
  const games = scores.data?.games ?? [];
  if (!games.length) return null;
  const sorted = [...games].sort((a, b) => Number(b.live) - Number(a.live) || String(a.start).localeCompare(String(b.start)));
  return (
    <section className="today-strip" aria-label="Today's games">
      <div className="today-head">
        <h2>Today</h2>
        <Link to="/games">All games</Link>
      </div>
      <div className="today-row">
        {sorted.map((g) => <ScoreTile key={g.id} g={g} compact />)}
      </div>
    </section>
  );
}
