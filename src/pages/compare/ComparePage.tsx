import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useSeason } from '../../lib/season';
import { seasonLabel } from '../../lib/format';
import { Segmented } from '../../components/Panel';
import { ComparePlayers } from './ComparePlayers';
import { CompareTeams } from './CompareTeams';
import { MAX } from './Pickers';

type Mode = 'players' | 'teams';

/**
 * Side-by-side comparison of up to three players or three teams. The selection lives in
 * the address (?players=8478402,8477934 or ?teams=TOR,BOS) so any comparison can be
 * bookmarked or opened from a player or team page.
 */
export function ComparePage() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('teams') != null && params.get('players') == null ? 'teams' : 'players';

  const players = (params.get('players') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX);
  const teams = (params.get('teams') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{3}$/.test(s)).slice(0, MAX);

  const update = useCallback((key: 'players' | 'teams', values: (string | number)[]) => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete(key === 'players' ? 'teams' : 'players');
      next.set(key, values.join(','));
      return next;
    }, { replace: true });
  }, [setParams]);

  const setMode = (m: Mode) => update(m, m === 'players' ? players : teams);

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Compare<span className="season">{seasonLabel(season)}</span></h1>
        <p className="page-lede">Put up to three {mode} side by side. Each one keeps the same color in every chart below.</p>
      </header>

      <div className="cmp-mode">
        <Segmented label="Compare" value={mode} onChange={setMode}
          options={[{ value: 'players', label: 'Players' }, { value: 'teams', label: 'Teams' }]} />
      </div>

      {mode === 'players'
        ? <ComparePlayers ids={players} onChange={(ids) => update('players', ids)} />
        : <CompareTeams abbrevs={teams} onChange={(a) => update('teams', a)} />}
    </>
  );
}
