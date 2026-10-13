import { useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { RinkMarkings } from '../../charts/Rink';
import { Segmented } from '../../components/Panel';
import { gameMinute, periodName } from '../../lib/games';
import type { GameShotsFull, RosterSpot } from '../../lib/types';

type Shot = GameShotsFull['shots'][number];
type FlowMetric = 'xg' | 'attempts' | 'onGoal';

const mmss = (sec: number | null) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
const STRENGTH: Record<string, string> = { PP: 'Power play', SH: 'Shorthanded', '5v5': '5 on 5', EV: 'Even strength' };

export function nameOf(roster: Map<number, RosterSpot>, id: number | null | undefined) {
  if (id == null) return 'Unknown';
  const r = roster.get(id);
  return r ? r.name : `#${id}`;
}

/**
 * Game flow: running total of expected goals (or shot attempts, or shots on goal) for
 * each team across the game clock, with every goal marked on its team's line. A team
 * pulling away shows as a widening gap; period breaks are marked.
 */
export function FlowChart({ data, colors }: { data: GameShotsFull; colors: { home: string; away: string } }) {
  const [metric, setMetric] = useState<FlowMetric>('xg');
  const roster = useMemo(() => new Map(data.roster.map((r) => [r.id, r])), [data.roster]);

  const option = useMemo<EChartsOption>(() => {
    const { home, away } = data.game;
    const shots = [...data.shots].sort((a, b) => gameMinute(a.period, a.sec, data.game.gameType) - gameMinute(b.period, b.sec, data.game.gameType));
    const counts = (s: Shot) => (metric === 'xg' ? s.xg : metric === 'attempts' ? 1 : s.kind === 'shot' || s.kind === 'goal' ? 1 : 0);
    const lastMin = Math.max(60, ...shots.map((s) => gameMinute(s.period, s.sec, data.game.gameType)));

    const build = (abbrev: string) => {
      let t = 0;
      const line: [number, number][] = [[0, 0]];
      const goals: { value: [number, number]; s: Shot }[] = [];
      for (const s of shots) {
        if (s.team !== abbrev) continue;
        const m = gameMinute(s.period, s.sec, data.game.gameType);
        line.push([m, Math.round(t * 100) / 100]); // step: flat until this shot
        t += counts(s);
        line.push([m, Math.round(t * 100) / 100]);
        if (s.kind === 'goal') goals.push({ value: [m, Math.round(t * 100) / 100], s });
      }
      line.push([data.game.state === 'LIVE' || data.game.state === 'CRIT' ? line[line.length - 1][0] : lastMin, Math.round(t * 100) / 100]);
      return { line, goals, total: t };
    };
    const A = build(away.abbrev), H = build(home.abbrev);
    const label = metric === 'xg' ? 'Expected goals' : metric === 'attempts' ? 'Shot attempts' : 'Shots on goal';
    const fmt = (v: number) => (metric === 'xg' ? v.toFixed(2) : String(Math.round(v)));

    const goalTip = (p: unknown) => {
      const d = (p as { data: { s: Shot } }).data;
      if (!d?.s) return '';
      const s = d.s;
      const assists = (s.assists ?? []).map((id) => nameOf(roster, id)).join(', ');
      return tipHead(`${s.team} goal: ${nameOf(roster, s.shooter)}`)
        + tipRow('When', `${periodName(s.period)} ${mmss(s.sec)}`)
        + (assists ? tipRow('Assists', assists) : tipRow('Assists', 'Unassisted'))
        + tipRow('Situation', s.emptyNet ? 'Empty net' : STRENGTH[s.strength] ?? s.strength)
        + tipRow('Chance quality', `${s.xg.toFixed(2)} xG`)
        + tipEnd;
    };
    const periodLines = [20, 40, ...(lastMin > 60 ? [60] : [])].map((x) => ({ xAxis: x }));
    // Keep the two end labels apart when the totals finish close together.
    const span = Math.max(A.total, H.total, 0.01);
    const close = Math.abs(A.total - H.total) / span < 0.12;
    const nudge = (d: typeof A) => (!close ? 0 : d === (A.total >= H.total ? A : H) ? -8 : 8);
    const line = (name: string, d: typeof A, color: string, dashed: boolean) => ([
      { name, type: 'line' as const, data: d.line, symbol: 'none', step: false as const,
        lineStyle: { color, width: 2.5, type: dashed ? [6, 3] as number[] : 'solid' as const }, itemStyle: { color },
        endLabel: { show: true, color: C.ink1, fontWeight: 600 as const, offset: [0, nudge(d)], formatter: () => `${name} ${fmt(d.total)}` },
        markLine: name === away.abbrev ? { silent: true, symbol: 'none', lineStyle: { color: C.axis, type: [3, 4] as number[] },
          label: { show: false }, data: periodLines } : undefined,
        z: 2 },
      { name, type: 'scatter' as const, data: d.goals, symbol: 'circle', symbolSize: 13,
        itemStyle: { color, borderColor: C.surface, borderWidth: 2 }, tooltip: { formatter: goalTip }, z: 4 },
    ]);

    return {
      grid: { left: 8, right: 86, top: 48, bottom: 30, containLabel: true },
      legend: { top: 0, right: 0, data: [away.abbrev, home.abbrev] },
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value', min: 0, max: Math.ceil(lastMin), interval: lastMin > 60 ? 5 : 10,
        axisLabel: { formatter: (v: number) => `${v}′` }, name: 'Game time (minutes)', nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', min: 0, name: label, nameTextStyle: { color: C.ink2, align: 'left', padding: [0, 0, 0, -20] } },
      series: [...line(away.abbrev, A, colors.away, true), ...line(home.abbrev, H, colors.home, false)],
    };
  }, [data, metric, colors, roster]);

  return (
    <>
      <div className="flow-tools">
        <Segmented label="Flow measure" value={metric} onChange={setMetric}
          options={[{ value: 'xg', label: 'Expected goals' }, { value: 'attempts', label: 'Shot attempts' }, { value: 'onGoal', label: 'Shots on goal' }]} />
        <span className="lg-note">Dots are goals; hover one for the scorer.</span>
      </div>
      <EChart option={option} height={340} ariaLabel="Game flow chart of running totals for both teams" />
    </>
  );
}

/**
 * Both teams on one full rink: home attacks the right net, away the left (away shots are
 * turned 180° from the normalized data). Goals are large team-colored dots, other attempts
 * smaller and fainter; size follows expected goals.
 */
export function GameShotMap({ data, colors }: { data: GameShotsFull; colors: { home: string; away: string } }) {
  const id = useId().replace(/:/g, '');
  const roster = useMemo(() => new Map(data.roster.map((r) => [r.id, r])), [data.roster]);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; rows: [string, string][] } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { home, away } = data.game;

  const order = { block: 0, miss: 1, shot: 2, goal: 3 } as const;
  const shots = [...data.shots].sort((a, b) => order[a.kind] - order[b.kind]);

  const show = (e: MouseEvent, s: Shot) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const what = s.kind === 'goal' ? 'Goal' : s.kind === 'shot' ? 'Saved' : s.kind === 'miss' ? 'Missed the net' : 'Blocked';
    setTip({
      x: e.clientX - r.left, y: e.clientY - r.top,
      title: `${s.team}: ${nameOf(roster, s.shooter)}`,
      rows: [
        ['Result', what],
        ['When', `${periodName(s.period)} ${mmss(s.sec)}`],
        ['Distance', `${Math.round(s.dist)} ft`],
        ['Expected goals', s.kind === 'block' ? 'not counted' : s.xg.toFixed(3)],
        ['Situation', s.emptyNet ? 'Empty net' : STRENGTH[s.strength] ?? s.strength],
      ],
    });
  };

  return (
    <div className="shotmap">
      <div className="game-rink-labels">
        <span><b style={{ color: colors.away }}>←</b> {away.abbrev} shooting</span>
        <span>{home.abbrev} shooting <b style={{ color: colors.home }}>→</b></span>
      </div>
      <div className="shotmap-stage" ref={wrap} onMouseLeave={() => setTip(null)}>
        <svg viewBox="-102 -44.5 204 89" role="img" aria-label={`Shot map of every attempt by ${away.abbrev} and ${home.abbrev}`}>
          <RinkMarkings id={`${id}r`} />
          <g transform="scale(-1,1)"><RinkMarkings id={`${id}l`} /></g>
          {shots.map((s, i) => {
            const isHome = s.team === home.abbrev;
            const x = isHome ? s.x : -s.x;
            const y = isHome ? s.y : -s.y;
            const color = isHome ? colors.home : colors.away;
            const r = s.kind === 'block' ? 0.6 : 0.9 + Math.sqrt(s.xg) * 2.8;
            const common = { cx: x, cy: y, r, onMouseMove: (e: MouseEvent) => show(e, s) };
            if (s.kind === 'goal') return <circle key={i} {...common} r={r + 0.6} fill={color} stroke="#fff" strokeWidth={0.45} />;
            if (s.kind === 'shot') return <circle key={i} {...common} fill={color} fillOpacity={0.45} />;
            if (s.kind === 'miss') return <circle key={i} {...common} fill="none" stroke={color} strokeOpacity={0.6} strokeWidth={0.3} />;
            return <circle key={i} {...common} fill={color} fillOpacity={0.3} />;
          })}
        </svg>
        {tip && (
          <div className="viz-tip shotmap-tip" style={{ left: tip.x, top: tip.y }}>
            <div className="tip-head">{tip.title}</div>
            {tip.rows.map(([k, v]) => <div className="tip-row" key={k}><span>{k}</span><b>{v}</b></div>)}
          </div>
        )}
      </div>
      <div className="shotmap-legend">
        <span><i className="lg-dot lg-goal-ring" />Goal</span>
        <span><i className="lg-dot lg-save" />Saved</span>
        <span><i className="lg-dot lg-miss" />Missed</span>
        <span><i className="lg-dot lg-block" />Blocked</span>
        <span className="lg-note">Bigger dot means a more dangerous chance. Hover any dot for the shooter.</span>
      </div>
    </div>
  );
}
