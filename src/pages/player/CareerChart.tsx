import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { Panel } from '../../components/Panel';
import { seasonTotals } from '../../lib/cards';
import { fmtDec, fmtSv, seasonLabel } from '../../lib/format';
import type { Player } from '../../lib/types';

/**
 * Career arc. Skaters: goals and assists stacked per season (the stack height is points).
 * Goalies: save % per season. The selected season is highlighted.
 */
export function CareerChart({ player, season }: { player: Player; season: string }) {
  const goalie = player.pos === 'G';
  const option = useMemo<EChartsOption>(() => {
    const ids = [...new Set(player.seasons.map((s) => s.season))].sort();
    const rows = ids.map((id) => seasonTotals(player.seasons, id)!);
    const birthYear = player.bio.birthDate ? Number(player.bio.birthDate.slice(0, 4)) : null;
    const cats = ids.map((id) => seasonLabel(id).replace(/^20/, "'"));
    const dim = (i: number) => (ids[i] === season ? 1 : 0.55);

    const tip = (i: number) => {
      const r = rows[i];
      let h = tipHead(`${seasonLabel(ids[i])} ${r.team}`);
      if (birthYear) h += tipRow('Age that season', String(Number(ids[i].slice(0, 4)) - birthYear));
      h += tipRow('Games', String(r.gp));
      if (goalie) {
        h += tipRow('Save %', fmtSv(r.savePct)) + tipRow('GAA', fmtDec(r.gaa ?? null)) + tipRow('Wins', String(r.wins ?? '–'));
      } else {
        h += tipRow('Goals', String(r.goals)) + tipRow('Assists', String(r.assists)) + tipRow('Points', String(r.points))
          + tipRow('Points per game', r.gp ? fmtDec((r.points ?? 0) / r.gp) : '–');
      }
      return h + tipEnd;
    };

    return {
      grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
      legend: goalie ? undefined : { top: 0, left: 0, data: ['Goals', 'Assists'] },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(168,184,207,0.06)' } },
        formatter: (ps: unknown) => tip((ps as { dataIndex: number }[])[0]?.dataIndex ?? 0) },
      xAxis: { type: 'category', data: cats },
      yAxis: goalie
        ? { type: 'value', min: (v: { min: number }) => Math.floor(v.min * 100) / 100, axisLabel: { formatter: (v: number) => fmtSv(v) } }
        : { type: 'value', minInterval: 1 },
      series: goalie
        ? [{ name: 'Save %', type: 'line', data: rows.map((r) => r.savePct), lineStyle: { color: C.series[0], width: 2 },
            itemStyle: { color: C.series[0] }, symbol: 'circle', symbolSize: 8 }]
        : [
            { name: 'Goals', type: 'bar', stack: 'p', barMaxWidth: 34, itemStyle: { color: C.series[0] },
              data: rows.map((r, i) => ({ value: r.goals ?? 0, itemStyle: { color: C.series[0], opacity: dim(i), borderRadius: 0 } })) },
            { name: 'Assists', type: 'bar', stack: 'p', barMaxWidth: 34, itemStyle: { color: C.series[2] },
              data: rows.map((r, i) => ({ value: r.assists ?? 0, itemStyle: { color: C.series[2], opacity: dim(i), borderRadius: [4, 4, 0, 0], borderColor: C.surface, borderWidth: 0 } })),
              label: { show: true, position: 'top', color: C.ink2, fontSize: 11, formatter: (p: unknown) => {
                const i = (p as { dataIndex: number }).dataIndex; return String(rows[i].points ?? '');
              } } },
          ],
    };
  }, [player, season, goalie]);

  if (player.seasons.length === 0) return null;
  return (
    <Panel title="Career arc" sub={goalie ? 'Save percentage by NHL season' : 'Goals and assists by NHL season; totals on top are points'}>
      <EChart option={option} height={280} ariaLabel="Career by season chart" />
    </Panel>
  );
}
