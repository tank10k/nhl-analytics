import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/Panel';
import { TeamLogo, TeamStripe } from '../../components/TeamChip';
import { fmtPct3, fmtSigned, recordStr } from '../../lib/format';
import { useSeason } from '../../lib/season';
import type { Team } from '../../lib/types';

const DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];

/** Small diverging bar for goal differential, centered on zero. */
function DiffBar({ value, max }: { value: number; max: number }) {
  const w = max ? (Math.abs(value) / max) * 50 : 0;
  return (
    <span className="diff-bar" aria-hidden>
      <span
        style={{
          width: `${w}%`,
          left: value >= 0 ? '50%' : `${50 - w}%`,
          background: value >= 0 ? 'var(--diverge-pos)' : 'var(--diverge-neg)',
        }}
      />
    </span>
  );
}

export function DivisionTables({ teams }: { teams: Team[] }) {
  const { link } = useSeason();

  const divisions = useMemo(() => {
    const by = new Map<string, Team[]>();
    for (const t of teams) {
      const list = by.get(t.division) ?? [];
      list.push(t);
      by.set(t.division, list);
    }
    const order = (d: string) => {
      const i = DIVISION_ORDER.indexOf(d);
      return i === -1 ? 99 : i;
    };
    return [...by.entries()]
      .sort(([a, ta], [b, tb]) => order(a) - order(b) || ta[0].conference.localeCompare(tb[0].conference) || a.localeCompare(b))
      .map(([name, list]) => ({
        name,
        conference: list[0].conference,
        teams: [...list].sort((a, b) => a.rank.division - b.rank.division),
      }));
  }, [teams]);

  const maxDiff = Math.max(1, ...teams.map((t) => Math.abs(t.goalDiff)));
  // Since 2013-14 the top three in each of these four divisions qualify.
  // Earlier formats (and the 2020-21 realignment) used different rules, so no line is drawn.
  const showCut = divisions.length === 4 && divisions.every((d) => DIVISION_ORDER.includes(d.name));

  return (
    <>
    <div className="grid-2">
      {divisions.map((d) => (
        <Panel key={d.name} title={`${d.name} Division`} sub={`${d.conference} Conference`}>
          <div className="table-scroll">
            <table className="table standings">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Rank and team</span></th>
                  <th scope="col" title="Games played">GP</th>
                  <th scope="col" title="Wins–losses–overtime losses">Record</th>
                  <th scope="col" title="Points">PTS</th>
                  <th scope="col" title="Points percentage">P%</th>
                  <th scope="col" title="Goal differential" colSpan={2}>Diff</th>
                  <th scope="col" title="Last 10 games">L10</th>
                </tr>
              </thead>
              <tbody>
                {d.teams.map((t, i) => (
                  <tr key={t.abbrev} className={showCut && i === 2 ? 'cutline' : undefined}>
                    <td>
                      <Link to={link(`/teams/${t.abbrev}`)} className="team-chip team-row-link">
                        <span className="rank">{t.rank.division}</span>
                        <TeamStripe abbrev={t.abbrev} />
                        <TeamLogo src={t.logo} size={24} />
                        <span className="team-abbr">{t.abbrev}</span>
                      </Link>
                    </td>
                    <td className="muted">{t.gp}</td>
                    <td>{recordStr(t.wins, t.losses, t.otLosses)}</td>
                    <td className="num-strong">{t.points}</td>
                    <td className="muted">{fmtPct3(t.pointPct)}</td>
                    <td className="diff-val">{fmtSigned(t.goalDiff)}</td>
                    <td className="diff-cell"><DiffBar value={t.goalDiff} max={maxDiff} /></td>
                    <td className="muted">{recordStr(t.l10.w, t.l10.l, t.l10.otl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
    {showCut && (
      <p className="table-note">Dashed line: the top three in each division make the playoffs, joined by two wild cards per conference.</p>
    )}
    </>
  );
}
