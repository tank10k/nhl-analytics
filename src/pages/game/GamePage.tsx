import { useCallback, useMemo, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../../lib/api';
import { useSeason } from '../../lib/season';
import { gameMinute, longDate, periodName } from '../../lib/games';
import { darkLogo, inkOn, mix, teamAccent, teamColors } from '../../lib/teams';
import { proxied } from '../../lib/img';
import { fmtSigned, fmtSv } from '../../lib/format';
import type { BoxResponse, BoxSide, GameShotsFull } from '../../lib/types';
import { C } from '../../charts/theme';
import { ErrorNotice, Panel, Skeleton } from '../../components/Panel';
import { useAutoRefresh } from '../games/ScoreTile';
import { FlowChart, GameShotMap, nameOf } from './GameCharts';
import { usePageTitle } from '../../lib/title';

type Shot = GameShotsFull['shots'][number];

/** Two team colors that can be told apart; if they're too close, away falls back to gray. */
function pickColors(away: string, home: string) {
  const h = teamAccent(home), a = teamAccent(away);
  const rgb = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = rgb(h), [r2, g2, b2] = rgb(a);
  const dist = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
  return { home: h, away: dist < 90 ? C.ink2 : a };
}

const mmss = (sec: number | null) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

function statusLine(g: GameShotsFull['game']) {
  if (g.state === 'OFF' || g.state === 'FINAL') return g.lastPeriodType && g.lastPeriodType !== 'REG' ? `Final/${g.lastPeriodType}` : 'Final';
  if (g.state === 'LIVE' || g.state === 'CRIT') {
    return g.intermission ? `${periodName(g.lastPeriod, g.lastPeriodType)} intermission` : `${periodName(g.lastPeriod, g.lastPeriodType)} ${g.clock?.replace(/^0/, '') ?? ''}`;
  }
  return 'Not started';
}

function Header({ g }: { g: GameShotsFull['game'] }) {
  const { link } = useSeason();
  const live = g.state === 'LIVE' || g.state === 'CRIT';
  const started = live || g.state === 'OFF' || g.state === 'FINAL';
  const side = (abbrev: string) => {
    const { primary } = teamColors(abbrev);
    return { '--side': primary, '--side-deep': mix(primary, '#050b16', 0.55), '--side-ink': inkOn(primary) } as CSSProperties;
  };
  const Team = ({ t, align }: { t: GameShotsFull['game']['home']; align: 'left' | 'right' }) => (
    <Link to={link(`/teams/${t.abbrev}`)} className={`gh-team gh-${align}`} style={side(t.abbrev)}>
      {t.logo && <img src={proxied(darkLogo(t.logo))} alt="" width={84} height={84} />}
      <span className="gh-abbr">{t.abbrev}</span>
      <span className="gh-score">{started ? t.score ?? 0 : ''}</span>
    </Link>
  );
  return (
    <header className="game-head">
      <Team t={g.away} align="left" />
      <div className="gh-mid">
        <span className={`gh-status${live ? ' is-live' : ''}`}>{live && <span className="live-dot" aria-hidden />}{statusLine(g)}</span>
        <span className="gh-date">{longDate(g.date)}</span>
        <span className="gh-at">{g.away.abbrev} at {g.home.abbrev}</span>
      </div>
      <Team t={g.home} align="right" />
    </header>
  );
}

function ScoringSummary({ data, colors }: { data: GameShotsFull; colors: { home: string; away: string } }) {
  const roster = new Map(data.roster.map((r) => [r.id, r]));
  const goals = data.shots
    .filter((s) => s.kind === 'goal')
    .sort((a, b) => gameMinute(a.period, a.sec, data.game.gameType) - gameMinute(b.period, b.sec, data.game.gameType));
  if (!goals.length) return <p className="empty">No goals yet.</p>;
  let a = 0, h = 0;
  const byPeriod = new Map<number, { s: Shot; score: string }[]>();
  for (const s of goals) {
    if (s.team === data.game.home.abbrev) h++; else a++;
    const list = byPeriod.get(s.period) ?? [];
    list.push({ s, score: `${a}–${h}` });
    byPeriod.set(s.period, list);
  }
  const tag = (s: Shot) => (s.emptyNet ? 'EN' : s.strength === 'PP' ? 'PP' : s.strength === 'SH' ? 'SH' : null);
  return (
    <div className="scoring">
      {[...byPeriod.entries()].map(([p, list]) => (
        <div key={p} className="scoring-period">
          <h3 className="sched-h">{periodName(p)} period</h3>
          <ul>
            {list.map(({ s, score }, i) => {
              const color = s.team === data.game.home.abbrev ? colors.home : colors.away;
              const assists = (s.assists ?? []).map((id) => nameOf(roster, id));
              return (
                <li key={i} className="goal-row">
                  <span className="goal-time">{mmss(s.sec)}</span>
                  <span className="team-stripe" style={{ background: color, height: 30 }} />
                  <span className="goal-team">{s.team}</span>
                  <span className="goal-who">
                    <b>{nameOf(roster, s.shooter)}</b>
                    <small>{assists.length ? assists.join(', ') : 'Unassisted'}</small>
                  </span>
                  {tag(s) && <span className="goal-tag" title={s.emptyNet ? 'Empty net' : s.strength === 'PP' ? 'Power play' : 'Shorthanded'}>{tag(s)}</span>}
                  <span className="goal-score" title={`${data.game.away.abbrev}–${data.game.home.abbrev} after this goal`}>{score}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Team totals as two-sided bars: away share grows left, home share grows right. */
function TeamBars({ data, box, colors }: { data: GameShotsFull; box?: BoxResponse; colors: { home: string; away: string } }) {
  const { home, away } = data.game;
  const of = (abbrev: string) => data.shots.filter((s) => s.team === abbrev);
  const sum = (side: BoxSide | undefined, k: 'hits' | 'blocks' | 'pim') => side ? side.skaters.reduce((t, p) => t + (p[k] ?? 0), 0) : null;
  const A = of(away.abbrev), H = of(home.abbrev);
  const rows: { label: string; a: number | null; h: number | null; fmt?: (v: number) => string }[] = [
    { label: 'Goals', a: away.score ?? A.filter((s) => s.kind === 'goal').length, h: home.score ?? H.filter((s) => s.kind === 'goal').length },
    { label: 'Shots on goal', a: A.filter((s) => s.kind === 'shot' || s.kind === 'goal').length, h: H.filter((s) => s.kind === 'shot' || s.kind === 'goal').length },
    { label: 'Shot attempts', a: A.length, h: H.length },
    { label: 'Expected goals', a: A.reduce((t, s) => t + s.xg, 0), h: H.reduce((t, s) => t + s.xg, 0), fmt: (v) => v.toFixed(2) },
    { label: 'Expected goals, 5 on 5', a: A.filter((s) => s.strength === '5v5').reduce((t, s) => t + s.xg, 0), h: H.filter((s) => s.strength === '5v5').reduce((t, s) => t + s.xg, 0), fmt: (v) => v.toFixed(2) },
    { label: 'Power-play goals', a: A.filter((s) => s.kind === 'goal' && s.strength === 'PP').length, h: H.filter((s) => s.kind === 'goal' && s.strength === 'PP').length },
    { label: 'Hits', a: sum(box?.away, 'hits'), h: sum(box?.home, 'hits') },
    { label: 'Blocked shots', a: sum(box?.away, 'blocks'), h: sum(box?.home, 'blocks') },
    { label: 'Penalty minutes', a: sum(box?.away, 'pim'), h: sum(box?.home, 'pim') },
  ];
  return (
    <div className="team-bars">
      <div className="tb-head"><span style={{ color: colors.away }}>{away.abbrev}</span><span style={{ color: colors.home }}>{home.abbrev}</span></div>
      {rows.filter((r) => r.a != null && r.h != null).map((r) => {
        const a = r.a!, h = r.h!, t = a + h;
        const f = r.fmt ?? ((v: number) => String(v));
        return (
          <div className="tb-row" key={r.label}>
            <span className="tb-val">{f(a)}</span>
            <span className="tb-mid">
              <span className="tb-label">{r.label}</span>
              <span className="tb-bar" aria-hidden>
                <span style={{ width: `${t ? (a / t) * 100 : 50}%`, background: colors.away }} />
                <span style={{ width: `${t ? (h / t) * 100 : 50}%`, background: colors.home }} />
              </span>
            </span>
            <span className="tb-val">{f(h)}</span>
          </div>
        );
      })}
    </div>
  );
}

function BoxTable({ side, color }: { side: BoxSide; color: string }) {
  const { link } = useSeason();
  const skaters = [...side.skaters].sort((a, b) => b.points - a.points || b.goals - a.goals || String(b.toi).localeCompare(String(a.toi)));
  return (
    <div>
      <h3 className="box-title"><span className="team-stripe" style={{ background: color, height: 20 }} />{side.name ?? side.abbrev}</h3>
      <div className="table-scroll">
        <table className="table box-table">
          <thead>
            <tr>
              <th scope="col">Skater</th><th scope="col">G</th><th scope="col">A</th><th scope="col">P</th>
              <th scope="col" title="Shots on goal">SOG</th><th scope="col">HIT</th><th scope="col" title="Blocked shots">BLK</th>
              <th scope="col">+/−</th><th scope="col" title="Time on ice">TOI</th>
            </tr>
          </thead>
          <tbody>
            {skaters.map((p) => (
              <tr key={p.id}>
                <td><span className="muted box-num">{p.number ?? ''}</span><Link className="player-link" to={link(`/players/${p.id}`)}>{p.name}</Link> <small className="muted">{p.pos}</small></td>
                <td>{p.goals}</td><td>{p.assists}</td><td className="num-strong">{p.points}</td>
                <td>{p.sog ?? '–'}</td><td>{p.hits ?? '–'}</td><td>{p.blocks ?? '–'}</td>
                <td>{p.plusMinus != null ? fmtSigned(p.plusMinus) : '–'}</td><td className="muted">{p.toi ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {side.goalies.length > 0 && (
        <div className="table-scroll">
          <table className="table box-table box-goalies">
            <thead>
              <tr><th scope="col">Goalie</th><th scope="col" title="Saves / shots against">SV/SA</th><th scope="col" title="Save percentage">SV%</th><th scope="col" title="Goals against">GA</th><th scope="col">Dec</th><th scope="col">TOI</th></tr>
            </thead>
            <tbody>
              {side.goalies.map((g) => (
                <tr key={g.id}>
                  <td><span className="muted box-num">{g.number ?? ''}</span><Link className="player-link" to={link(`/players/${g.id}`)}>{g.name}</Link></td>
                  <td>{g.saves ?? '–'}/{g.shotsAgainst ?? '–'}</td><td className="num-strong">{fmtSv(g.savePct)}</td>
                  <td>{g.goalsAgainst ?? '–'}</td><td>{g.decision ?? '–'}</td><td className="muted">{g.toi ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function GamePage() {
  const { id = '' } = useParams();
  const { link } = useSeason();
  const shots = useApi<GameShotsFull>(`/api/game/${id}/shots`);
  const box = useApi<BoxResponse>(`/api/game/${id}/box`);
  const d = shots.data;
  usePageTitle(d ? `${d.game.away.abbrev} ${d.game.away.score ?? ''} at ${d.game.home.abbrev} ${d.game.home.score ?? ''}`.replace(/ +/g, ' ').trim() : 'Game');
  const live = d?.game.state === 'LIVE' || d?.game.state === 'CRIT';
  const { retry: retryShots } = shots;
  const { retry: retryBox } = box;
  const refresh = useCallback(() => { retryShots(); retryBox(); }, [retryShots, retryBox]);
  useAutoRefresh(live, refresh);

  const colors = useMemo(() => (d ? pickColors(d.game.away.abbrev, d.game.home.abbrev) : { home: C.series[0], away: C.series[1] }), [d]);
  const started = d && (live || d.game.state === 'OFF' || d.game.state === 'FINAL');

  return (
    <div className="game-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to={link(d?.game.date ? `/games?date=${d.game.date}` : '/games')}>Games</Link>
        <span aria-hidden>/</span>
        <span>{d ? `${d.game.away.abbrev} at ${d.game.home.abbrev}` : 'Game'}</span>
      </nav>

      {shots.error && (shots.error.status === 404 || shots.error.status === 400
        ? <div className="notice notice-quiet"><p>No NHL game has the id {id}. Open one from the <Link to="/games">scoreboard</Link>.</p></div>
        : <ErrorNotice error={shots.error} onRetry={shots.retry} />)}
      {!d && !shots.error && <Skeleton height={170} style={{ borderRadius: 14 }} />}

      {d && (
        <>
          <Header g={d.game} />
          {live && <p className="refresh-note game-refresh"><span className="live-dot" aria-hidden />Live: updates every 30 seconds</p>}
          {!started ? (
            <div className="notice notice-quiet"><p>This game hasn't started yet. Charts, shots and the box score appear once the puck drops.</p></div>
          ) : (
            <div className="game-grid">
              <Panel className="span-2" title="Game flow" sub="Running totals through the game. A widening gap means one team is controlling play.">
                <FlowChart data={d} colors={colors} />
              </Panel>
              <Panel className="span-2" title="Shot map" sub="Every attempt in the game, both teams on one rink">
                <GameShotMap data={d} colors={colors} />
              </Panel>
              <Panel title="Scoring" sub="Goals in order, with the score after each">
                <ScoringSummary data={d} colors={colors} />
              </Panel>
              <Panel title="Team stats" sub="Expected goals from this app's shot model">
                <TeamBars data={d} box={box.data} colors={colors} />
              </Panel>
              <Panel className="span-2" title="Box score">
                {box.data ? (
                  <div className="grid-2 box-grid">
                    <BoxTable side={box.data.away} color={colors.away} />
                    <BoxTable side={box.data.home} color={colors.home} />
                  </div>
                ) : box.error ? <ErrorNotice error={box.error} onRetry={box.retry} /> : <Skeleton height={420} />}
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
