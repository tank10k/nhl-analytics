import { useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Segmented } from '../components/Panel';
import { RINK, RinkMarkings } from './Rink';
import { hexbin, hexPath } from './hexbin';
import type { ShotKind, Strength } from '../lib/types';

export interface MapShot {
  x: number;
  y: number;
  xg: number;
  kind: ShotKind;
  strength: Strength;
}

type View = 'dots' | 'heat';
type StrengthFilter = 'all' | '5v5' | 'PP' | 'SH';

const KIND_LABEL: Record<ShotKind, string> = { goal: 'Goal', shot: 'Shot on goal', miss: 'Missed the net', block: 'Blocked' };
const HEX_R = 3.4; // feet

const dist = (s: MapShot) => Math.hypot(RINK.goalX - s.x, s.y);

/**
 * Shot map on the offensive half-rink.
 * Dots: every attempt, sized by expected goals (bigger = more dangerous); goals in the
 *   team color, saves as filled gray, misses as rings, blocked attempts as small marks.
 * Heat: unblocked attempts binned into hexagons, shaded by the expected goals produced
 *   from each zone (one hue, brighter = more danger).
 */
export function ShotMap({ shots, accent, label, defaultView = 'dots' }: {
  shots: MapShot[];
  accent: string;
  label: string;
  defaultView?: View;
}) {
  const id = useId().replace(/:/g, '');
  const [view, setView] = useState<View>(defaultView);
  const [strength, setStrength] = useState<StrengthFilter>('all');
  const [tip, setTip] = useState<{ x: number; y: number; lines: [string, string][]; title: string } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => shots.filter((s) => strength === 'all'
    || (strength === '5v5' ? s.strength === '5v5' : s.strength === strength)), [shots, strength]);

  const totals = useMemo(() => {
    const t = { attempts: filtered.length, onGoal: 0, goals: 0, xg: 0, unblocked: 0, distSum: 0 };
    for (const s of filtered) {
      if (s.kind === 'goal' || s.kind === 'shot') t.onGoal++;
      if (s.kind === 'goal') t.goals++;
      if (s.kind !== 'block') { t.unblocked++; t.distSum += dist(s); }
      t.xg += s.xg;
    }
    return t;
  }, [filtered]);

  const hexes = useMemo(() => {
    if (view !== 'heat') return [];
    const bins = hexbin(filtered.filter((s) => s.kind !== 'block'), (s) => s.x, (s) => s.y, HEX_R);
    const withV = bins.map((b) => ({ ...b, xg: b.items.reduce((a, s) => a + s.xg, 0), goals: b.items.filter((s) => s.kind === 'goal').length }));
    const max = Math.max(0.0001, ...withV.map((b) => b.xg));
    return withV.map((b) => ({ ...b, t: b.xg / max }));
  }, [filtered, view]);

  // draw order: blocks, misses, saves, goals on top
  const ordered = useMemo(() => {
    const rank: Record<ShotKind, number> = { block: 0, miss: 1, shot: 2, goal: 3 };
    return [...filtered].sort((a, b) => rank[a.kind] - rank[b.kind] || a.xg - b.xg);
  }, [filtered]);

  const show = (e: MouseEvent, title: string, lines: [string, string][]) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, title, lines });
  };

  const hexD = hexPath(HEX_R * 0.96);
  const many = filtered.length > 600;

  return (
    <div className="shotmap">
      <div className="shotmap-tools">
        <Segmented label="Map view" value={view} onChange={setView}
          options={[{ value: 'dots', label: 'Every shot' }, { value: 'heat', label: 'Danger zones' }]} />
        <Segmented label="Strength" value={strength} onChange={setStrength}
          options={[{ value: 'all', label: 'All' }, { value: '5v5', label: '5 on 5' }, { value: 'PP', label: 'Power play' }, { value: 'SH', label: 'Shorthanded' }]} />
      </div>

      <div className="shotmap-stage" ref={wrap} onMouseLeave={() => setTip(null)}>
        <svg viewBox="-2 -44.5 104 89" role="img" aria-label={`${label}: ${totals.attempts} shot attempts, ${totals.goals} goals, ${totals.xg.toFixed(1)} expected goals`}>
          <RinkMarkings id={id} />
          <g clipPath={`url(#clip-${id})`}>
            {view === 'heat' && hexes.map((h, i) => (
              <path
                key={i}
                d={hexD}
                transform={`translate(${h.cx},${h.cy})`}
                fill="var(--series-1)"
                fillOpacity={0.1 + 0.85 * Math.pow(h.t, 0.75)}
                stroke="var(--surface-1)"
                strokeWidth={0.25}
                onMouseMove={(e) => show(e, 'This zone', [
                  ['Unblocked attempts', String(h.items.length)],
                  ['Goals', String(h.goals)],
                  ['Expected goals', h.xg.toFixed(2)],
                  ['Shooting %', h.items.length ? `${((h.goals / h.items.length) * 100).toFixed(1)}%` : '–'],
                ])}
              />
            ))}
            {view === 'dots' && ordered.map((s, i) => {
              // With a full season of shots, non-goals shrink so the goals and hot spots stay readable.
              const scale = many && s.kind !== 'goal' ? 0.6 : 1;
              const r = s.kind === 'block' ? 0.5 : (0.8 + Math.sqrt(s.xg) * 2.6) * scale;
              const common = {
                cx: s.x, cy: s.y, r,
                onMouseMove: (e: MouseEvent) => show(e, KIND_LABEL[s.kind], [
                  ['Distance', `${dist(s).toFixed(0)} ft`],
                  ['Expected goals', s.kind === 'block' ? 'not counted' : s.xg.toFixed(3)],
                  ['Strength', s.strength === 'PP' ? 'Power play' : s.strength === 'SH' ? 'Shorthanded' : s.strength === '5v5' ? '5 on 5' : 'Even strength'],
                ]),
              };
              if (s.kind === 'goal') return <circle key={i} {...common} fill={accent} stroke="var(--surface-1)" strokeWidth={0.3} />;
              if (s.kind === 'shot') return <circle key={i} {...common} fill="var(--ink-2)" fillOpacity={many ? 0.28 : 0.5} />;
              if (s.kind === 'miss') return <circle key={i} {...common} fill="none" stroke="var(--ink-3)" strokeOpacity={many ? 0.35 : 0.7} strokeWidth={0.3} />;
              return <circle key={i} {...common} fill="var(--ink-3)" fillOpacity={0.4} />;
            })}
          </g>
        </svg>
        {tip && (
          <div className="viz-tip shotmap-tip" style={{ left: tip.x, top: tip.y }}>
            <div className="tip-head">{tip.title}</div>
            {tip.lines.map(([k, v]) => <div className="tip-row" key={k}><span>{k}</span><b>{v}</b></div>)}
          </div>
        )}
      </div>

      <div className="shotmap-legend">
        {view === 'dots' ? (
          <>
            <span><i className="lg-dot" style={{ background: accent }} />Goal</span>
            <span><i className="lg-dot lg-save" />Shot on goal</span>
            <span><i className="lg-dot lg-miss" />Missed</span>
            <span><i className="lg-dot lg-block" />Blocked</span>
            <span className="lg-note">Bigger dot means a more dangerous chance. Hover any dot for details.</span>
          </>
        ) : (
          <>
            <span className="lg-ramp" aria-hidden />
            <span className="lg-note">Brighter zones produced more expected goals. Blocked shots are left out. Hover a zone for its numbers.</span>
          </>
        )}
      </div>

      <dl className="shotmap-stats">
        <div><dt>Attempts</dt><dd>{totals.attempts}</dd></div>
        <div><dt>On goal</dt><dd>{totals.onGoal}</dd></div>
        <div><dt>Goals</dt><dd>{totals.goals}</dd></div>
        <div><dt>Expected goals</dt><dd>{totals.xg.toFixed(1)}</dd></div>
        <div title="Goals minus expected goals: above zero means finishing better than the chances suggest">
          <dt>Goals − xG</dt><dd>{(totals.goals - totals.xg) >= 0 ? '+' : '−'}{Math.abs(totals.goals - totals.xg).toFixed(1)}</dd>
        </div>
        <div><dt>Avg distance</dt><dd>{totals.unblocked ? `${(totals.distSum / totals.unblocked).toFixed(0)} ft` : '–'}</dd></div>
      </dl>
    </div>
  );
}
