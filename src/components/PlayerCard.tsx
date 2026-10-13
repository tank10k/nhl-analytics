import { useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { CardData } from '../lib/cards';
import { proxied } from '../lib/img';
import { darkLogo, hemColors, inkOn, mix, teamAccent, teamColors } from '../lib/teams';
import { fmtHeight, fmtSigned, ordinal, posLabel, seasonLabel } from '../lib/format';
import { Sparkline } from './Sparkline';

/**
 * The player card. Hero in the team's colors with the sweater number and a hem-stripe
 * band (the stripes across the bottom of a hockey sweater); name, bio and numbers sit
 * on the dark panel below so they read the same for every team.
 *
 * size="full": bio, six percentile bars, last-10 sparkline, flip side with career, image export.
 * size="compact": stat line, three percentile bars, sparkline; links to the player page.
 */
export function PlayerCard({ card, size = 'full', href }: { card: CardData; size?: 'full' | 'compact'; href?: string }) {
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'busy' | 'failed'>('idle');
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const { primary } = teamColors(card.team);
  const accent = teamAccent(card.team);
  const [hem1, hem2] = hemColors(card.team);
  const vars = {
    '--team-primary': primary,
    '--team-deep': mix(primary, '#050b16', 0.55),
    '--team-ink': inkOn(primary),
    '--team-accent': accent,
    '--hem-1': hem1,
    '--hem-2': hem2,
  } as CSSProperties;

  const compact = size === 'compact';
  const pct = compact ? card.pct.slice(0, 3) : card.pct;

  async function saveImage() {
    const node = flipped ? backRef.current : frontRef.current;
    if (!node) return;
    setSaving('busy');
    const { toPng } = await import('html-to-image');
    const base = {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#101d33',
      style: { transform: 'none' }, // the back face is rotated for the flip; export it flat
    };
    let url: string | null = null;
    try {
      url = await toPng(node, base);
    } catch (err) {
      // A photo that can't be drawn would sink the whole export; try once without it.
      console.warn('Card export failed, retrying without the photo:', err);
      try {
        url = await toPng(node, { ...base, filter: (n: HTMLElement) => !n.classList?.contains('pc-headshot') });
      } catch (err2) {
        console.error('Card export failed:', err2);
      }
    }
    if (!url) { setSaving('failed'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${card.firstName}-${card.lastName}-${card.season}${flipped ? '-career' : ''}.png`.replace(/\s+/g, '-');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setSaving('idle');
  }

  const front = (
    <div className="pc-face pc-front" ref={frontRef}>
      <div className="pc-hero">
        {card.teamLogo && <img className="pc-logo" src={proxied(darkLogo(card.teamLogo))} alt="" width={44} height={44} />}
        {card.number != null && <span className="pc-number" aria-hidden>{card.number}</span>}
        {card.headshot && <img className="pc-headshot" src={proxied(card.headshot)} alt="" />}
        <div className="pc-hem" aria-hidden><span /><span /><span /></div>
      </div>

      <div className="pc-body">
        <div className="pc-name">
          <span className="pc-first">{card.firstName}</span>
          <span className="pc-last">
            {href && compact ? <Link to={href}>{card.lastName}</Link> : card.lastName}
          </span>
          <span className="pc-role">
            {posLabel[card.pos] ?? card.pos}
            {card.number != null && <> · #{card.number}</>}
            {card.team && <> · {card.team}</>}
          </span>
        </div>

        {!compact && card.bio && <Bio bio={card.bio} />}

        <dl className="pc-line" aria-label={`${card.season} season`}>
          {card.line.map((s) => (
            <div key={s.label} title={s.title}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>

        {pct.length > 0 && (
          <div className="pc-pct">
            {pct.map((p) => (
              <div className="pc-pct-row" key={p.key} title={`${p.label}: ${p.value} (${ordinal(p.pct)} percentile)`}>
                <span className="pc-pct-label">{p.label}</span>
                <span className="pc-pct-track"><span style={{ width: `${Math.max(p.pct, 2)}%` }} /></span>
                <span className="pc-pct-num">{p.pct}</span>
              </div>
            ))}
          </div>
        )}
        {card.pctNote && <p className="pc-note">{card.pctNote}</p>}

        {card.spark && (
          <div className="pc-spark">
            <Sparkline values={card.spark.values} kind={card.spark.kind} color={accent} width={compact ? 100 : 132} label={card.spark.caption} />
            <span>{card.spark.caption}</span>
          </div>
        )}

        <div className="pc-foot">
          <span>{card.season} regular season</span>
          <span className="pc-brand" aria-hidden><i /><i /><i /></span>
        </div>
      </div>
    </div>
  );

  if (compact) {
    return <article className="pcard pcard-compact" style={vars} aria-label={`${card.firstName} ${card.lastName}`}>{front}</article>;
  }

  return (
    <div className="pcard-wrap">
      <article className={`pcard${flipped ? ' is-flipped' : ''}`} style={vars} aria-label={`${card.firstName} ${card.lastName} player card`}>
        <div className="pcard-inner">
          {front}
          <div className="pc-face pc-back" ref={backRef} aria-hidden={!flipped}>
            <Career card={card} />
          </div>
        </div>
      </article>
      <div className="pcard-actions">
        <button type="button" className="btn" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
          {flipped ? 'Show this season' : 'Show career'}
        </button>
        <button type="button" className="btn" onClick={saveImage} disabled={saving === 'busy'}>
          {saving === 'busy' ? 'Saving…' : 'Save as image'}
        </button>
        {saving === 'failed' && <span className="pcard-err" role="status">Couldn't create the image. Check the server is running and try again.</span>}
      </div>
    </div>
  );
}

function Bio({ bio }: { bio: NonNullable<CardData['bio']> }) {
  const draft = bio.draft
    ? `${bio.draft.year} ${bio.draft.team}, ${ordinal(bio.draft.overall)} overall`
    : 'Undrafted';
  const items: [string, string][] = [
    ['Age', bio.age != null ? String(bio.age) : '–'],
    ['Height', fmtHeight(bio.heightIn)],
    ['Weight', bio.weightLb != null ? `${bio.weightLb} lb` : '–'],
    ['Shoots', bio.shoots ?? '–'],
    ['Born', bio.birthPlace ?? '–'],
    ['Draft', draft],
  ];
  return (
    <dl className="pc-bio">
      {items.map(([k, v]) => (
        <div key={k} className={k === 'Born' || k === 'Draft' ? 'wide' : undefined}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Career({ card }: { card: CardData }) {
  const isGoalie = card.pos === 'G';
  const rows = [...card.career].reverse();
  const tot = card.career.reduce(
    (a, s) => ({
      gp: a.gp + s.gp, g: a.g + (s.goals ?? 0), a: a.a + (s.assists ?? 0), p: a.p + (s.points ?? 0),
      w: a.w + (s.wins ?? 0), so: a.so + (s.shutouts ?? 0),
    }),
    { gp: 0, g: 0, a: 0, p: 0, w: 0, so: 0 },
  );
  return (
    <div className="pc-career">
      <div className="pc-career-head">
        <span className="pc-first">{card.firstName}</span>
        <span className="pc-last">{card.lastName}</span>
        <span className="pc-role">NHL career, regular season</span>
      </div>
      <div className="pc-career-scroll">
        <table className="table pc-career-table">
          <thead>
            <tr>
              <th scope="col">Season</th>
              <th scope="col">Team</th>
              <th scope="col">GP</th>
              {isGoalie
                ? <><th scope="col">W</th><th scope="col">SV%</th><th scope="col">SO</th></>
                : <><th scope="col">G</th><th scope="col">A</th><th scope="col">P</th><th scope="col">+/−</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={`${s.season}-${s.team}-${i}`}>
                <td>{seasonLabel(s.season)}</td>
                <td className="muted pc-team-cell">{s.team}</td>
                <td>{s.gp}</td>
                {isGoalie
                  ? <><td>{s.wins ?? '–'}</td><td>{s.savePct != null ? s.savePct.toFixed(3).replace(/^0/, '') : '–'}</td><td>{s.shutouts ?? '–'}</td></>
                  : <><td>{s.goals}</td><td>{s.assists}</td><td className="num-strong">{s.points}</td><td>{fmtSigned(s.plusMinus ?? 0)}</td></>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Career</td>
              <td>{tot.gp}</td>
              {isGoalie
                ? <><td>{tot.w}</td><td /><td>{tot.so}</td></>
                : <><td>{tot.g}</td><td>{tot.a}</td><td className="num-strong">{tot.p}</td><td /></>}
            </tr>
          </tfoot>
        </table>
      </div>
      {card.awards.length > 0 && (
        <div className="pc-awards">
          {card.awards.map((a) => (
            <span key={a.name} className="pc-award">
              {a.name}
              {a.seasons.length > 0 && <small>{a.seasons.map((s) => seasonLabel(s)).join(', ')}</small>}
            </span>
          ))}
        </div>
      )}
      <div className="pc-foot">
        <span>{card.career.length} NHL season{card.career.length === 1 ? '' : 's'}</span>
        <span className="pc-brand" aria-hidden><i /><i /><i /></span>
      </div>
    </div>
  );
}
