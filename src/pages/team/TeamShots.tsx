import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { useApi } from '../../lib/api';
import { fmtPct } from '../../lib/format';
import { gameAxisInterval, trailing } from '../../lib/stats';
import type { CompactShot, TeamShotsResponse } from '../../lib/types';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { ShotMap, type MapShot } from '../../charts/ShotMap';
import { ErrorNotice, Panel, Segmented, Skeleton } from '../../components/Panel';

const toMap = (rows: CompactShot[]): MapShot[] =>
  rows.map(([x, y, xg, kind, strength]) => ({ x, y, xg, kind, strength }));

function ShareTile({ label, value, note }: { label: string; value: number | null; note: string }) {
  return (
    <div className="share-tile">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value == null ? '–' : fmtPct(value)}</span>
      <span className="share-bar" aria-hidden>
        <span style={{ width: `${(value ?? 0) * 100}%` }} /><i />
      </span>
      <span className="kpi-note">{note}</span>
    </div>
  );
}

/** Rolling share of expected goals vs. share of actual goals, game by game. */
function XgTrend({ data, accent }: { data: TeamShotsResponse; accent: string }) {
  const option = useMemo<EChartsOption>(() => {
    const g = data.games;
    const n = g.length;
    const w = n >= 20 ? 10 : 5;
    const xf = trailing(g.map((x) => x.xgFor), w), xa = trailing(g.map((x) => x.xgAgainst), w);
    const gf = trailing(g.map((x) => x.gf), w), ga = trailing(g.map((x) => x.ga), w);
    const share = (a: (number | null)[], b: (number | null)[]) => a.map((v, i) => {
      const t = (v ?? 0) + (b[i] ?? 0);
      return t ? Math.round(((v ?? 0) / t) * 1000) / 10 : null;
    });
    const xs = share(xf, xa), gs = share(gf, ga);
    const few = n <= 15;
    return {
      grid: { left: 8, right: 16, top: 36, bottom: 28, containLabel: true },
      legend: { top: 0, left: 0, data: ['Expected goals share', 'Actual goals share'] },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
          const from = Math.max(1, i + 2 - w);
          return tipHead(from === i + 1 ? `Game ${i + 1}` : `Games ${from}–${i + 1}`)
            + tipRow('Expected goals share', xs[i] != null ? `${xs[i]}%` : '–')
            + tipRow('Actual goals share', gs[i] != null ? `${gs[i]}%` : '–')
            + tipRow(`Game ${i + 1}`, `${g[i].home ? 'vs' : '@'} ${g[i].opp}, ${g[i].gf}–${g[i].ga}, xG ${g[i].xgFor.toFixed(1)}–${g[i].xgAgainst.toFixed(1)}`)
            + tipEnd;
        },
      },
      xAxis: { type: 'category', data: g.map((_, i) => String(i + 1)), boundaryGap: few,
        axisLabel: { interval: gameAxisInterval(n) },
        name: `Game number (average of up to ${w} games)`, nameLocation: 'middle', nameGap: 26 },
      // Zoom to the data (most teams live between 40% and 60%), but always keep 50% in view.
      yAxis: { type: 'value',
        min: (v: { min: number }) => Math.min(40, Math.floor(v.min / 10) * 10),
        max: (v: { max: number }) => Math.max(60, Math.ceil(v.max / 10) * 10),
        axisLabel: { formatter: '{value}%' } },
      series: [
        { name: 'Expected goals share', type: 'line', data: xs, symbol: 'circle', showSymbol: few, symbolSize: 7,
          lineStyle: { color: accent, width: 2.5 }, itemStyle: { color: accent },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: C.ink3, type: [4, 4] },
            label: { formatter: 'Even', color: C.ink3, position: 'insideEndTop' }, data: [{ yAxis: 50 }] } },
        { name: 'Actual goals share', type: 'line', data: gs, symbol: 'circle', showSymbol: few, symbolSize: 6,
          lineStyle: { color: C.ink2, width: 1.75, type: [6, 4] }, itemStyle: { color: C.ink2 } },
      ],
    };
  }, [data, accent]);
  return <EChart option={option} height={260} ariaLabel="Rolling expected goals share and actual goals share" />;
}

/**
 * Shots for and against over the season. Reads every finished game's play-by-play,
 * so the first load of a season takes a while; later loads come from the cache.
 */
export function TeamShots({ team, season, accent }: { team: string; season: string; accent: string }) {
  const [side, setSide] = useState<'for' | 'against'>('for');
  const shots = useApi<TeamShotsResponse>(`/api/team/${team}/shots?season=${season}`);
  const d = shots.data;
  const mapShots = useMemo(() => (d ? toMap(side === 'for' ? d.for : d.against) : []), [d, side]);
  const f5 = d?.summary.fiveOnFive;

  return (
    <>
      <Panel
        className="span-2"
        title="Shot map"
        sub={d
          ? `${d.gamesLoaded} game${d.gamesLoaded === 1 ? '' : 's'}, all shots ${side === 'for' ? `taken by ${team}` : `taken against ${team}`}, shown attacking the net on the right.`
          : 'Every shot attempt this season, placed on the rink'}
        tools={<Segmented label="Whose shots" value={side} onChange={setSide}
          options={[{ value: 'for', label: `${team} shooting` }, { value: 'against', label: `Against ${team}` }]} />}
      >
        {shots.error ? <ErrorNotice error={shots.error} onRetry={shots.retry} /> : !d ? (
          <div className="shot-loading">
            <Skeleton height={420} />
            <p className="table-note">Reading every game's play-by-play. The first load of a season can take 10 to 30 seconds; after that it's instant.</p>
          </div>
        ) : d.gamesLoaded === 0 ? <p className="empty">No finished games to map yet.</p> : (
          <div className="shot-layout">
            <ShotMap key={side} shots={mapShots} accent={side === 'for' ? accent : 'var(--diverge-neg)'} label={`${team} shot map`} />
            <div className="share-col">
              <ShareTile label="Shot attempts share, 5 on 5" value={f5?.corsiPct ?? null}
                note={`${f5?.for.attempts ?? 0} for, ${f5?.against.attempts ?? 0} against`} />
              <ShareTile label="Expected goals share, 5 on 5" value={f5?.xgPct ?? null}
                note={`${f5?.for.xg.toFixed(1) ?? 0} for, ${f5?.against.xg.toFixed(1) ?? 0} against`} />
              <ShareTile label="Actual goals share, 5 on 5" value={f5 && f5.for.goals + f5.against.goals ? f5.for.goals / (f5.for.goals + f5.against.goals) : null}
                note={`${f5?.for.goals ?? 0} for, ${f5?.against.goals ?? 0} against`} />
              <p className="share-help">The line in each bar is 50%. Expected goals share is the best single read on who controls games; when actual goals run well ahead of it, some luck is involved.</p>
            </div>
          </div>
        )}
      </Panel>
      {d && d.games.length > 0 && (
        <Panel className="span-2" title="Expected goals trend" sub="Share of the game's expected goals vs. share of the actual goals, rolling average. Above 50% means outplaying opponents.">
          <XgTrend data={d} accent={accent} />
        </Panel>
      )}
    </>
  );
}
