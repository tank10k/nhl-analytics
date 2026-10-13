import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { fmtDec, fmtToi } from '../../lib/format';
import { useSeason } from '../../lib/season';
import { teamAccent } from '../../lib/teams';
import type { Skater } from '../../lib/types';

export const per60 = (p: Skater, v: number) => {
  const hours = (p.toiPerGame * p.gp) / 3600;
  return hours > 0 ? v / hours : 0;
};

/**
 * Production vs. usage: ice time per game against points per 60 minutes, forwards and
 * defense as two series. Players high on the chart with modest ice time are producing
 * more than their minutes suggest.
 */
export function ProductionScatter({ players }: { players: Skater[] }) {
  const navigate = useNavigate();
  const { link } = useSeason();

  const option = useMemo<EChartsOption>(() => {
    const rows = players.filter((p) => p.toiPerGame > 0).map((p) => ({
      p,
      x: p.toiPerGame / 60,
      y: per60(p, p.points),
    }));
    // Label the top scorers only, so names never cover the field.
    const labelled = new Set([...rows].sort((a, b) => b.p.points - a.p.points).slice(0, 6).map((r) => r.p.id));
    const mk = (pred: (p: Skater) => boolean) => rows.filter((r) => pred(r.p)).map((r) => ({
      value: [r.x, r.y],
      id: r.p.id,
      p: r.p,
      label: labelled.has(r.p.id)
        ? { show: true, formatter: r.p.name.split(' ').slice(-1)[0], position: 'right' as const, color: C.ink1, fontSize: 12, fontWeight: 600 as const }
        : undefined,
    }));

    const tooltip = (x: unknown) => {
      const p = (x as { data: { p: Skater } }).data.p;
      const team = p.teams[p.teams.length - 1];
      return tipHead(p.name, teamAccent(team))
        + tipRow('Team', p.teams.join('/'))
        + tipRow('Points per 60', fmtDec(per60(p, p.points)))
        + tipRow('Ice time per game', fmtToi(p.toiPerGame))
        + tipRow('Points', `${p.points} in ${p.gp} GP`)
        + tipEnd;
    };

    const dot = { symbolSize: 8, itemStyle: { borderColor: C.surface, borderWidth: 1, opacity: 0.85 }, emphasis: { scale: 1.6 } };
    return {
      grid: { left: 8, right: 70, top: 48, bottom: 14, containLabel: true },
      legend: { top: 0, right: 0, data: ['Forwards', 'Defense'] },
      labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
      tooltip: { trigger: 'item', formatter: tooltip },
      xAxis: { type: 'value', scale: true, name: 'Ice time per game (min) →', nameLocation: 'end', nameGap: 8,
        nameTextStyle: { color: C.ink2, align: 'right', verticalAlign: 'top', padding: [22, 0, 0, 0] } },
      yAxis: { type: 'value', name: 'Points per 60 min', nameGap: 16, nameTextStyle: { color: C.ink2, align: 'left', padding: [0, 0, 0, -24] } },
      series: [
        { name: 'Forwards', type: 'scatter', data: mk((p) => p.pos !== 'D'), ...dot, color: C.series[0], cursor: 'pointer' },
        { name: 'Defense', type: 'scatter', data: mk((p) => p.pos === 'D'), ...dot, color: C.series[1], cursor: 'pointer' },
      ],
    };
  }, [players]);

  return (
    <EChart
      option={option}
      height={400}
      ariaLabel="Scatter of ice time per game against points per 60 minutes"
      onReady={(c) => c.on('click', (e) => {
        const id = (e.data as { id?: number } | undefined)?.id;
        if (id) navigate(link(`/players/${id}`));
      })}
    />
  );
}
