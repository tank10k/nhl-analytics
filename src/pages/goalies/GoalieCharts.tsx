import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { EChartsOption } from 'echarts';
import { EChart } from '../../charts/EChart';
import { C, tipEnd, tipHead, tipRow } from '../../charts/theme';
import { fmtDec, fmtSv } from '../../lib/format';
import { useSeason } from '../../lib/season';
import { teamAccent } from '../../lib/teams';
import type { GoalieRow } from '../../lib/goalies';

const lastName = (n: string) => n.split(' ').slice(1).join(' ') || n;
const team = (g: GoalieRow) => g.teams[g.teams.length - 1];
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

function goalieTip(g: GoalieRow) {
  return tipHead(g.name, teamAccent(team(g)))
    + tipRow('Team', g.teams.join('/'))
    + tipRow('Saves above average', g.gsaa != null ? signed(g.gsaa) : '–')
    + tipRow('Save %', fmtSv(g.savePct))
    + tipRow('Goals against avg', fmtDec(g.gaa))
    + tipRow('Shots against', `${g.shotsAgainst ?? '–'} in ${g.gp} GP`)
    + tipEnd;
}

function useOpen() {
  const navigate = useNavigate();
  const { link } = useSeason();
  return (chart: import('echarts').ECharts) => chart.on('click', (e) => {
    const id = (e.data as { id?: number } | undefined)?.id;
    if (id) navigate(link(`/players/${id}`));
  });
}

/**
 * Goals saved above average: how many more (or fewer) goals each goalie has kept out
 * than a league-average goalie would have on the same number of shots. Diverging bars,
 * best at the top. With many goalies, the top and bottom 10 are shown.
 */
export function GsaaBars({ rows }: { rows: GoalieRow[] }) {
  const onReady = useOpen();
  const { option, height, trimmed } = useMemo(() => {
    const all = rows.filter((g) => g.gsaa != null).sort((a, b) => (b.gsaa ?? 0) - (a.gsaa ?? 0));
    const trimmed = all.length > 20;
    const shown = trimmed ? [...all.slice(0, 10), ...all.slice(-10)] : all;
    const list = [...shown].reverse(); // ECharts draws category 0 at the bottom
    const option: EChartsOption = {
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'item', formatter: (p: unknown) => goalieTip((p as { data: { g: GoalieRow } }).data.g) },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v > 0 ? `+${v}` : String(v)) } },
      yAxis: {
        type: 'category', data: list.map((g) => `${lastName(g.name)} · ${team(g)}`),
        axisLabel: { color: C.ink2, fontSize: 12 }, axisLine: { show: false },
      },
      series: [{
        type: 'bar', barMaxWidth: 14, cursor: 'pointer',
        data: list.map((g) => ({
          value: Math.round((g.gsaa ?? 0) * 10) / 10, id: g.id, g,
          itemStyle: { color: (g.gsaa ?? 0) >= 0 ? C.series[0] : C.series[1], borderRadius: (g.gsaa ?? 0) >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
        })),
        label: { show: true, position: 'right', color: C.ink2, fontSize: 11, formatter: (p: { value: unknown }) => signed(Number(p.value)) },
        markLine: { silent: true, symbol: 'none', data: [{ xAxis: 0 }], lineStyle: { color: C.axis, type: 'solid' }, label: { show: false } },
      }],
    };
    return { option, height: Math.max(220, list.length * 22 + 40), trimmed };
  }, [rows]);

  if (!rows.length) return <p className="empty">No goalies match these filters.</p>;
  return (
    <>
      <EChart option={option} height={height} ariaLabel="Bar chart of goals saved above average for each goalie" onReady={onReady} />
      {trimmed && <p className="table-note">Showing the top 10 and bottom 10. The full list is in the leaderboard.</p>}
    </>
  );
}

/**
 * Workload against quality: games started across, save percentage up. Lines at the
 * league save % and the median workload split the field into four groups.
 */
export function WorkloadScatter({ rows, leagueSv }: { rows: GoalieRow[]; leagueSv: number | null }) {
  const onReady = useOpen();
  const option = useMemo<EChartsOption>(() => {
    const pts = rows.filter((g) => g.savePct != null && g.gs != null);
    const starts = pts.map((g) => g.gs as number).sort((a, b) => a - b);
    const medGs = starts.length ? starts[Math.floor(starts.length / 2)] : 0;
    const labelled = new Set([...pts].sort((a, b) => (b.gsaa ?? 0) - (a.gsaa ?? 0)).slice(0, 5).map((g) => g.id));
    const svs = pts.map((g) => g.savePct as number);
    const lo = Math.min(...svs, leagueSv ?? 1), hi = Math.max(...svs, leagueSv ?? 0);
    const pad = Math.max(0.004, (hi - lo) * 0.12);
    const corner = (text: string, x: 'left' | 'right', y: 'top' | 'bottom') => ({
      type: 'text' as const, [x]: x === 'left' ? 64 : 24, [y]: y === 'top' ? 48 : 78, silent: true,
      style: { text, fill: C.ink3, font: `600 12px Barlow, sans-serif` },
    });
    return {
      grid: { left: 8, right: 24, top: 40, bottom: 34, containLabel: true },
      tooltip: { trigger: 'item', formatter: (p: unknown) => goalieTip((p as { data: { g: GoalieRow } }).data.g) },
      labelLayout: { hideOverlap: true },
      graphic: [
        corner('Heavy load, strong', 'right', 'top'),
        corner('Light load, strong', 'left', 'top'),
        corner('Heavy load, struggling', 'right', 'bottom'),
        corner('Light load, struggling', 'left', 'bottom'),
      ],
      xAxis: { type: 'value', name: 'Games started', nameLocation: 'middle', nameGap: 26, min: 0 },
      yAxis: {
        type: 'value', min: Math.floor((lo - pad) * 1000) / 1000, max: Math.ceil((hi + pad) * 1000) / 1000,
        name: 'Save %', nameTextStyle: { color: C.ink2, align: 'left', padding: [0, 0, 0, -24] },
        axisLabel: { formatter: (v: number) => fmtSv(v) },
      },
      series: [{
        type: 'scatter', cursor: 'pointer',
        data: pts.map((g) => ({
          value: [g.gs, g.savePct], id: g.id, g,
          symbolSize: 8 + Math.sqrt(g.gp) * 1.2,
          itemStyle: { color: teamAccent(team(g)), borderColor: C.surface, borderWidth: 1.5, opacity: 0.9 },
          label: labelled.has(g.id)
            ? { show: true, formatter: lastName(g.name), position: 'right' as const, color: C.ink1, fontSize: 12, fontWeight: 600 as const }
            : undefined,
        })),
        emphasis: { scale: 1.4 },
        markLine: {
          silent: true, symbol: 'none', lineStyle: { color: C.axis, type: [4, 4] },
          data: [
            ...(leagueSv != null ? [{ yAxis: leagueSv, label: { formatter: `League ${fmtSv(leagueSv)}`, color: C.ink3, position: 'insideStartTop' as const } }] : []),
            { xAxis: medGs, label: { show: false } },
          ],
        },
      }],
    };
  }, [rows, leagueSv]);

  if (!rows.length) return <p className="empty">No goalies match these filters.</p>;
  return <EChart option={option} height={500} ariaLabel="Scatter of games started against save percentage" onReady={onReady} />;
}
