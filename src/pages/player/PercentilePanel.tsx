import { Panel } from '../../components/Panel';
import { fmtMetric, ordinal } from '../../lib/format';
import type { PlayerPercentiles } from '../../lib/types';

/**
 * All percentile ranks as horizontal bars on a 0-100 scale with a tick at the median.
 * One hue (magnitude); the exact value and rank are always printed, so color is never
 * the only carrier.
 */
export function PercentilePanel({ data }: { data: PlayerPercentiles }) {
  const group = data.group === 'D' ? 'defensemen' : 'forwards';
  return (
    <Panel
      title="Percentile profile"
      sub={data.eligible
        ? `Ranked against ${data.poolSize} ${group} with at least ${data.minGp} games. 50 is the median.`
        : `Not ranked yet: needs ${data.minGp} games played.`}
    >
      <div className="pctl" role="table" aria-label="Percentile ranks">
        <div className="pctl-row pctl-head" role="row">
          <span role="columnheader">Measure</span>
          <span role="columnheader" className="r">Value</span>
          <span role="columnheader"><span className="sr-only">Rank bar</span></span>
          <span role="columnheader" className="r">Pctl</span>
        </div>
        {data.metrics.map((m) => {
          const p = data.pct[m.key];
          return (
            <div className="pctl-row" role="row" key={m.key}>
              <span role="cell">{m.label}</span>
              <span role="cell" className="r muted">{fmtMetric(m.key, data.values[m.key])}</span>
              <span role="cell" className="pctl-track" aria-hidden>
                {p != null && <span className="pctl-fill" style={{ width: `${Math.max(p, 1.5)}%` }} />}
                <span className="pctl-mid" />
              </span>
              <span role="cell" className="r pctl-num" title={p != null ? `${ordinal(p)} percentile` : 'Not ranked'}>
                {p ?? '–'}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
