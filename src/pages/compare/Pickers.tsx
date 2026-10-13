import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { TeamLogo, TeamStripe } from '../../components/TeamChip';
import type { Skater, Team } from '../../lib/types';

export const SLOT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
export const SLOT_HEX = ['#3987e5', '#d95926', '#199e70']; // same three, for charts
export const MAX = 3;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Selected items as chips, each wearing its comparison color, plus a remove button. */
function Chip({ color, label, sub, onRemove, children }: {
  color: string; label: string; sub?: string; onRemove: () => void; children?: ReactNode;
}) {
  return (
    <span className="cmp-chip" style={{ '--slot': color } as CSSProperties}>
      <span className="cmp-chip-swatch" aria-hidden />
      {children}
      <span className="cmp-chip-text"><b>{label}</b>{sub && <small>{sub}</small>}</span>
      <button type="button" className="cmp-chip-x" onClick={onRemove} aria-label={`Remove ${label}`}>×</button>
    </span>
  );
}

/** Type-ahead search over every skater this season. */
export function PlayerPicker({ all, selected, onAdd, onRemove }: {
  all: Skater[];
  selected: number[];
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    return all
      .filter((p) => !selected.includes(p.id) && norm(p.name).includes(n))
      .sort((a, b) => Number(norm(b.name).startsWith(n)) - Number(norm(a.name).startsWith(n)) || b.points - a.points)
      .slice(0, 8);
  }, [all, q, selected]);

  const pick = (id: number) => { onAdd(id); setQ(''); setActive(0); input.current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active].id); }
    else if (e.key === 'Escape') setQ('');
  };

  const full = selected.length >= MAX;
  return (
    <div className="cmp-picker">
      {selected.map((id, i) => {
        const p = byId.get(id);
        return (
          <Chip key={id} color={SLOT_COLORS[i]} label={p?.name ?? `Player ${id}`} sub={p ? `${p.teams.join('/')} · ${p.pos}` : undefined} onRemove={() => onRemove(id)} />
        );
      })}
      {!full && (
        <div className="cmp-search">
          <input
            ref={input}
            className="input"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder={selected.length ? 'Add another player' : 'Find a player to compare'}
            aria-label="Find a player"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="cmp-results"
            autoComplete="off"
          />
          {results.length > 0 && (
            <ul className="cmp-results" id="cmp-results" role="listbox">
              {results.map((p, i) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(p.id); }}
                >
                  <TeamStripe abbrev={p.teams[p.teams.length - 1]} />
                  <span>{p.name}</span>
                  <small>{p.teams.join('/')} · {p.pos} · {p.points} pts</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {full && <span className="cmp-full">Three players is the most a comparison can hold. Remove one to swap.</span>}
    </div>
  );
}

/** Team selection: chips for the chosen teams and a select for the rest. */
export function TeamPicker({ all, selected, onAdd, onRemove }: {
  all: Team[];
  selected: string[];
  onAdd: (abbrev: string) => void;
  onRemove: (abbrev: string) => void;
}) {
  const byAbbrev = new Map(all.map((t) => [t.abbrev, t]));
  const rest = [...all].filter((t) => !selected.includes(t.abbrev)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="cmp-picker">
      {selected.map((a, i) => {
        const t = byAbbrev.get(a);
        return (
          <Chip key={a} color={SLOT_COLORS[i]} label={t?.name ?? a} sub={t ? `${t.points} pts` : undefined} onRemove={() => onRemove(a)}>
            <TeamLogo src={t?.logo} size={24} />
          </Chip>
        );
      })}
      {selected.length < MAX ? (
        <label className="field">
          <span className="sr-only">Add a team</span>
          <select className="select" value="" onChange={(e) => e.target.value && onAdd(e.target.value)}>
            <option value="">{selected.length ? 'Add another team' : 'Choose a team to compare'}</option>
            {rest.map((t) => <option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}
          </select>
        </label>
      ) : <span className="cmp-full">Three teams is the most a comparison can hold. Remove one to swap.</span>}
    </div>
  );
}
