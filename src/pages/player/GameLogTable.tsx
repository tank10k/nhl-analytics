import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { TeamStripe } from '../../components/TeamChip';
import { fmtSigned, fmtSv } from '../../lib/format';
import type { GameLogEntry } from '../../lib/types';

const dateFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function GameLogTable({ games, goalie }: { games: GameLogEntry[]; goalie: boolean }) {
  const [all, setAll] = useState(false);
  const rows = [...games].sort((a, b) => b.date.localeCompare(a.date));
  const shown = all ? rows : rows.slice(0, 10);

  return (
    <Panel
      title="Game log"
      sub={`${games.length} game${games.length === 1 ? '' : 's'} this season, newest first`}
      tools={rows.length > 10 && (
        <button type="button" className="btn" onClick={() => setAll((v) => !v)}>
          {all ? 'Show last 10' : `Show all ${rows.length}`}
        </button>
      )}
    >
      {rows.length === 0 ? <p className="empty">No games played this season yet.</p> : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Opponent</th>
                {goalie ? (
                  <>
                    <th scope="col" title="Decision">Dec</th>
                    <th scope="col" title="Shots against">SA</th>
                    <th scope="col" title="Goals against">GA</th>
                    <th scope="col" title="Save percentage">SV%</th>
                  </>
                ) : (
                  <>
                    <th scope="col" title="Goals">G</th>
                    <th scope="col" title="Assists">A</th>
                    <th scope="col" title="Points">P</th>
                    <th scope="col" title="Shots on goal">SOG</th>
                    <th scope="col" title="Plus/minus">+/−</th>
                    <th scope="col" title="Penalty minutes">PIM</th>
                    <th scope="col" title="Time on ice">TOI</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((g, i) => (
                <tr key={g.gameId ?? `${g.date}-${i}`}>
                  <td className="muted">{dateFmt(g.date)}</td>
                  <td>
                    <span className="team-chip">
                      <span className="muted log-ha">{g.homeRoad === 'H' ? 'vs' : '@'}</span>
                      <TeamStripe abbrev={g.opp} height={14} />
                      <span className="team-abbr">{g.opp}</span>
                    </span>
                  </td>
                  {goalie ? (
                    <>
                      <td>{g.decision ?? '–'}</td>
                      <td>{g.shotsAgainst ?? '–'}</td>
                      <td>{g.goalsAgainst ?? '–'}</td>
                      <td className="num-strong">{fmtSv(g.savePct)}</td>
                    </>
                  ) : (
                    <>
                      <td>{g.goals}</td>
                      <td>{g.assists}</td>
                      <td className="num-strong">{g.points}</td>
                      <td>{g.shots}</td>
                      <td>{fmtSigned(g.plusMinus)}</td>
                      <td className="muted">{g.pim}</td>
                      <td className="muted">{g.toi}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
