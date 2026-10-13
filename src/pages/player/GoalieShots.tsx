import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { useApi } from '../../lib/api';
import type { GoalieShotsResponse } from '../../lib/types';
import { ShotMap } from '../../charts/ShotMap';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { gameAxisInterval } from '../../lib/stats';
import { ErrorNotice, Panel, Skeleton } from '../../components/Panel';

const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Running goals saved above expected: climbs in games where the goalie stops more than
 * the quality of the chances suggests, falls when he lets in more. Each game is a bar
 * (blue above zero, orange below) under the running total.
 */
function GsaxTrend({ games }: { games: GoalieShotsResponse['games'] }) {
  const option = useMemo<EChartsOption>(() => {
    let run = 0;
    const running = games.map((g) => (run = Math.round((run + g.gsax) * 100) / 100));
    const n = games.length;
    return {
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      legend: { top: 0, right: 0, data: ['Running total', 'Single game'] },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: unknown) => {
          const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
          const g = games[i];
          return tipHead(`Game ${i + 1} · ${shortDate(g.date)}`)
            + tipRow('Goals against', `${g.goalsAgainst} on ${g.onGoal} shots`)
            + tipRow('Expected against', g.xga.toFixed(2))
            + tipRow('This game', signed(g.gsax, 2))
            + tipRow('Season so far', signed(running[i], 1))
            + tipEnd;
        },
      },
      xAxis: { type: 'category', data: games.map((_, i) => String(i + 1)), axisLabel: { interval: gameAxisInterval(n) }, name: 'Game', nameLocation: 'end' },
      yAxis: { type: 'value', name: 'Goals saved above expected', nameTextStyle: { color: C.ink2, align: 'left', padding: [0, 0, 0, -24] } },
      series: [
        {
          name: 'Single game', type: 'bar', barMaxWidth: 10,
          data: games.map((g) => ({ value: g.gsax, itemStyle: { color: g.gsax >= 0 ? C.series[0] : C.series[1], opacity: 0.55, borderRadius: g.gsax >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })),
          itemStyle: { color: C.series[0] },
        },
        {
          name: 'Running total', type: 'line', data: running, symbol: n <= 15 ? 'circle' : 'none', symbolSize: 6,
          lineStyle: { color: C.ink1, width: 2.5 }, itemStyle: { color: C.ink1 }, z: 3,
          markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: C.axis, type: 'solid' }, label: { show: false } },
        },
      ],
    };
  }, [games]);
  return <EChart option={option} height={320} ariaLabel="Goals saved above expected, game by game and running total" />;
}

/** Shots a goalie faced this season on the rink, plus his goals saved above expected. */
export function GoalieShots({ playerId, season, accent }: { playerId: number; season: string; accent: string }) {
  const res = useApi<GoalieShotsResponse>(`/api/goalie/${playerId}/shots?season=${season}`);
  const d = res.data;
  const shots = useMemo(() => (d ? d.shots.map(([x, y, xg, kind, strength]) => ({ x, y, xg, kind, strength })) : []), [d]);
  const s = d?.summary;
  const hdSv = s && s.highDanger.faced ? 1 - s.highDanger.goalsAgainst / s.highDanger.faced : null;

  if (res.error) return <Panel title="Shots faced"><ErrorNotice error={res.error} onRetry={res.retry} /></Panel>;
  if (!d) {
    return (
      <Panel title="Shots faced" sub="Every unblocked shot he faced this season, placed on the rink">
        <Skeleton height={420} />
        <p className="table-note">Reading this goalie's games. The first load of a season can take a little while.</p>
      </Panel>
    );
  }
  if (!d.shots.length) {
    return <Panel title="Shots faced"><p className="empty">No shots faced in finished games this season yet.</p></Panel>;
  }
  return (
    <>
      <Panel
        title="Goals saved above expected"
        sub={`${signed(s!.gsax)} over ${d.gamesLoaded} games: he allowed ${s!.goalsAgainst} goals on chances worth ${s!.xga.toFixed(1)} expected. Above zero means stopping more than the shots' quality suggests.`}
      >
        <GsaxTrend games={d.games} />
      </Panel>
      <Panel
        title="Shots faced"
        sub={`${s!.faced} unblocked shots, ${s!.highDanger.faced} of them high-danger (15%+ chance of scoring)${hdSv != null ? `, saved at ${hdSv.toFixed(3).replace(/^0/, '')}` : ''}. Shots are drawn toward the net he defended.`}
      >
        <ShotMap shots={shots} accent={accent} label="Shots faced" goalie />
      </Panel>
    </>
  );
}
