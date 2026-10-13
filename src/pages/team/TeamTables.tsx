import { Link } from 'react-router';
import { useSeason } from '../../lib/season';
import { fmtDec, fmtPct3, fmtSigned, fmtSv, fmtToi, recordStr } from '../../lib/format';
import type { Goalie, ScheduleGame, Skater } from '../../lib/types';
import { TeamLogo, TeamStripe } from '../../components/TeamChip';

// ---------- splits ----------

interface Split { label: string; note?: string; games: ScheduleGame[] }

function line(s: Split) {
  const g = s.games;
  const w = g.filter((x) => x.result === 'W').length;
  const otl = g.filter((x) => x.result === 'OTL').length;
  const l = g.length - w - otl;
  const pts = w * 2 + otl;
  const gf = g.reduce((a, x) => a + (x.gf ?? 0), 0);
  const ga = g.reduce((a, x) => a + (x.ga ?? 0), 0);
  return { gp: g.length, w, l, otl, pct: g.length ? pts / (g.length * 2) : null, gf: g.length ? gf / g.length : null, ga: g.length ? ga / g.length : null };
}

/** Home/road and close-game splits computed from the schedule's final scores. */
export function Splits({ games }: { games: ScheduleGame[] }) {
  const done = games.filter((g) => g.gameNumber && g.result);
  const splits: Split[] = [
    { label: 'Home', games: done.filter((g) => g.home) },
    { label: 'Road', games: done.filter((g) => !g.home) },
    { label: 'One-goal games', note: 'Final margin of one, incl. OT/SO', games: done.filter((g) => Math.abs((g.gf ?? 0) - (g.ga ?? 0)) === 1) },
    { label: 'Past regulation', note: 'Decided in overtime or a shootout', games: done.filter((g) => g.decidedIn === 'OT' || g.decidedIn === 'SO') },
    { label: 'Blowouts', note: 'Final margin of three or more', games: done.filter((g) => Math.abs((g.gf ?? 0) - (g.ga ?? 0)) >= 3) },
  ];
  return (
    <div className="table-scroll">
      <table className="table splits">
        <thead>
          <tr>
            <th scope="col">Split</th>
            <th scope="col">GP</th>
            <th scope="col">Record</th>
            <th scope="col" title="Points percentage">P%</th>
            <th scope="col"><span className="sr-only">Points percentage bar</span></th>
            <th scope="col" title="Goals for per game">GF/GP</th>
            <th scope="col" title="Goals against per game">GA/GP</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((s) => {
            const r = line(s);
            return (
              <tr key={s.label}>
                <td><span className="split-label">{s.label}</span>{s.note && <small className="split-note">{s.note}</small>}</td>
                <td className="muted">{r.gp}</td>
                <td>{recordStr(r.w, r.l, r.otl)}</td>
                <td className="num-strong">{fmtPct3(r.pct)}</td>
                <td className="split-bar-cell">
                  <span className="split-bar" aria-hidden><span style={{ width: `${(r.pct ?? 0) * 100}%` }} /><i /></span>
                </td>
                <td>{fmtDec(r.gf)}</td>
                <td>{fmtDec(r.ga)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- roster ----------

export function RosterTables({ skaters, goalies }: { skaters: Skater[]; goalies: Goalie[] }) {
  const { link } = useSeason();
  const groups = [
    { title: 'Forwards', rows: skaters.filter((p) => p.pos !== 'D') },
    { title: 'Defense', rows: skaters.filter((p) => p.pos === 'D') },
  ];
  return (
    <div className="roster-tables">
      {groups.map((g) => (
        <div key={g.title} className="table-scroll">
          <table className="table">
            <caption className="roster-cap">{g.title}</caption>
            <thead>
              <tr>
                <th scope="col">Player</th><th scope="col">Pos</th><th scope="col">GP</th><th scope="col">G</th>
                <th scope="col">A</th><th scope="col">P</th><th scope="col" title="Plus/minus">+/−</th>
                <th scope="col" title="Time on ice per game">TOI</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((p) => (
                <tr key={p.id}>
                  <td><Link className="player-link" to={link(`/players/${p.id}`)}>{p.name}</Link>{p.teams.length > 1 && <small className="muted"> {p.teams.join('/')}</small>}</td>
                  <td className="muted">{p.pos}</td><td>{p.gp}</td><td>{p.goals}</td><td>{p.assists}</td>
                  <td className="num-strong">{p.points}</td><td>{fmtSigned(p.plusMinus)}</td><td className="muted">{fmtToi(p.toiPerGame)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {goalies.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <caption className="roster-cap">Goalies</caption>
            <thead>
              <tr>
                <th scope="col">Player</th><th scope="col">GP</th><th scope="col">W</th><th scope="col">L</th>
                <th scope="col" title="Overtime losses">OTL</th><th scope="col" title="Save percentage">SV%</th>
                <th scope="col" title="Goals against average">GAA</th><th scope="col" title="Shutouts">SO</th>
              </tr>
            </thead>
            <tbody>
              {goalies.map((p) => (
                <tr key={p.id}>
                  <td><Link className="player-link" to={link(`/players/${p.id}`)}>{p.name}</Link></td>
                  <td>{p.gp}</td><td>{p.wins ?? '–'}</td><td>{p.losses ?? '–'}</td><td>{p.otLosses ?? '–'}</td>
                  <td className="num-strong">{fmtSv(p.savePct)}</td><td>{fmtDec(p.gaa)}</td><td>{p.shutouts ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- schedule ----------

const dateFmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function ScheduleLists({ games }: { games: ScheduleGame[] }) {
  const { link } = useSeason();
  const done = games.filter((g) => g.result).slice(-5).reverse();
  const next = games.filter((g) => !g.result && g.state !== 'OFF' && g.state !== 'FINAL').slice(0, 5);
  const row = (g: ScheduleGame) => (
    <li key={g.id} className="sched-row">
      <span className="sched-date">{dateFmt(g.date)}</span>
      <span className="sched-ha">{g.home ? 'vs' : '@'}</span>
      {g.opp ? (
        <Link to={link(`/teams/${g.opp}`)} className="team-chip team-row-link">
          <TeamStripe abbrev={g.opp} />
          <TeamLogo src={g.oppLogo ?? undefined} size={22} />
          <span className="team-abbr">{g.opp}</span>
        </Link>
      ) : <span>TBD</span>}
      {g.result ? (
        <Link to={link(`/games/${g.id}`)} className={`sched-res res-${g.result.toLowerCase()}`} title="Open this game">
          <b>{g.result === 'W' ? 'W' : g.result === 'OTL' ? (g.decidedIn === 'SO' ? 'SOL' : 'OTL') : 'L'}</b> {g.gf}–{g.ga}
        </Link>
      ) : g.state === 'LIVE' || g.state === 'CRIT'
        ? <Link to={link(`/games/${g.id}`)} className="sched-res">Live now</Link>
        : <span className="sched-res muted">Upcoming</span>}
    </li>
  );
  return (
    <div className="sched">
      <div>
        <h3 className="sched-h">Recent results</h3>
        {done.length ? <ul className="sched-list">{done.map(row)}</ul> : <p className="empty">No games played yet.</p>}
      </div>
      <div>
        <h3 className="sched-h">Next games</h3>
        {next.length ? <ul className="sched-list">{next.map(row)}</ul> : <p className="empty">No upcoming games this season.</p>}
      </div>
    </div>
  );
}
