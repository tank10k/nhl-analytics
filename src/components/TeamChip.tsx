import { useState } from 'react';
import { darkLogo, teamAccent } from '../lib/teams';

/** Team logo that disappears cleanly (leaving the color stripe) if it can't load. */
export function TeamLogo({ src, size = 22, alt = '' }: { src?: string; size?: number; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const url = darkLogo(src);
  if (!url || failed) return null;
  return (
    <img
      className="team-logo"
      src={url}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function TeamStripe({ abbrev, height = 18 }: { abbrev?: string | null; height?: number }) {
  return <span className="team-stripe" style={{ background: teamAccent(abbrev), height }} aria-hidden />;
}

/** Color stripe + logo + abbreviation, optionally with the full name. */
export function TeamChip({ abbrev, logo, name, showName = false }: {
  abbrev: string;
  logo?: string;
  name?: string;
  showName?: boolean;
}) {
  return (
    <span className="team-chip" title={name}>
      <TeamStripe abbrev={abbrev} />
      <TeamLogo src={logo} />
      <span className="team-abbr">{abbrev}</span>
      {showName && name && <span className="team-name">{name}</span>}
    </span>
  );
}
