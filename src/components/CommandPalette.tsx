import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '../lib/api';
import { useSeason } from '../lib/season';
import { posLabel } from '../lib/format';
import type { GoaliesResponse, SkatersResponse, StandingsResponse } from '../lib/types';
import { IconSearch } from './Icons';
import { TeamChip, TeamStripe } from './TeamChip';

interface Result {
  kind: 'team' | 'player';
  key: string;
  href: string;
  render: () => ReactNode;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Score a name against the query: whole-name prefix > word prefix > substring. */
function score(name: string, q: string): number {
  const n = norm(name);
  if (n.startsWith(q)) return 3;
  if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 2;
  return n.includes(q) ? 1 : 0;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { season, link } = useSeason();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Only load the search index once the palette has been opened.
  const standings = useApi<StandingsResponse>(open ? `/api/standings?season=${season}` : null);
  const skaters = useApi<SkatersResponse>(open ? `/api/skaters?season=${season}&limit=2000` : null);
  const goalies = useApi<GoaliesResponse>(open ? `/api/goalies?season=${season}&limit=500` : null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = norm(query.trim());
    const teams = standings.data?.teams ?? [];
    // Goalies join the player list, ranked by wins where skaters rank by points.
    type Hit = { id: number; name: string; teams: string[]; pos: string; rank: number; meta: string };
    const players: Hit[] = [
      ...(skaters.data?.players ?? []).map((p) => ({ id: p.id, name: p.name, teams: p.teams, pos: p.pos, rank: p.points, meta: `${p.points} pts` })),
      ...(goalies.data?.goalies ?? []).map((g) => ({ id: g.id, name: g.name, teams: g.teams, pos: 'G', rank: (g.wins ?? 0) * 2, meta: `${g.wins ?? 0} W` })),
    ];

    const teamHits = teams
      .map((t) => ({ t, s: q ? Math.max(score(t.name, q), score(t.abbrev, q)) : 1 }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name))
      .slice(0, q ? 4 : 0);

    const playerHits = q
      ? players
          .map((p) => ({ p, s: score(p.name, q) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s || b.p.rank - a.p.rank)
          .slice(0, 8)
      : players.filter((p) => p.pos !== 'G').sort((a, b) => b.rank - a.rank).slice(0, 6).map((p) => ({ p, s: 1 }));

    return [
      ...teamHits.map(({ t }) => ({
        kind: 'team' as const,
        key: `t-${t.abbrev}`,
        href: link(`/teams/${t.abbrev}`),
        render: () => (
          <>
            <TeamChip abbrev={t.abbrev} logo={t.logo} />
            <span className="label">{t.name}</span>
            <span className="meta">{t.points} pts</span>
          </>
        ),
      })),
      ...playerHits.map(({ p }) => {
        const team = p.teams[p.teams.length - 1];
        return {
          kind: 'player' as const,
          key: `p-${p.id}`,
          href: link(`/players/${p.id}`),
          render: () => (
            <>
              <TeamStripe abbrev={team} />
              <span className="label">{p.name}</span>
              <span className="meta">{p.teams.join('/')} · {posLabel[p.pos] ?? p.pos} · {p.meta}</span>
            </>
          ),
        };
      }),
    ];
  }, [query, standings.data, skaters.data, goalies.data, link]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (r?: Result) => {
    if (!r) return;
    onClose();
    navigate(r.href);
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const loading = standings.loading || skaters.loading;
  let lastKind: Result['kind'] | null = null;

  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search players and teams" onKeyDown={onKey}>
        <div className="palette-input">
          <IconSearch />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players and teams"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active]?.key}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" id="palette-results" role="listbox" ref={listRef}>
          {results.map((r, i) => {
            const header = r.kind !== lastKind
              ? <li key={`h-${r.kind}`} className="palette-group" role="presentation">
                  {r.kind === 'team' ? 'Teams' : query ? 'Players' : 'Top scorers'}
                </li>
              : null;
            lastKind = r.kind;
            return [
              header,
              <li
                key={r.key}
                id={r.key}
                role="option"
                aria-selected={i === active}
                className="palette-item"
                onMouseMove={() => setActive(i)}
                onClick={() => go(r)}
              >
                {r.render()}
              </li>,
            ];
          })}
          {!results.length && (
            <li className="empty" role="presentation">
              {loading ? 'Loading players…' : `No player or team matches “${query}” this season.`}
            </li>
          )}
        </ul>
        <div className="palette-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
          <span><kbd>Enter</kbd> to open</span>
        </div>
      </div>
    </div>
  );
}

/** Opens the palette on Ctrl/Cmd+K or "/" (when not typing in a field). */
export function usePaletteHotkey(setOpen: (v: boolean | ((o: boolean) => boolean)) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}
