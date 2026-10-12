import type { CSSProperties, ReactNode } from 'react';
import type { ApiError } from '../lib/api';

export function Panel({ title, sub, tools, children, className = '' }: {
  title: ReactNode;
  sub?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <div>
          <h2 className="panel-title">{title}</h2>
          {sub && <p className="panel-sub">{sub}</p>}
        </div>
        {tools && <div className="tools">{tools}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: {
  height?: number | string;
  width?: number | string;
  style?: CSSProperties;
}) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden />;
}

export function SkeletonRows({ rows = 6, height = 22 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: 'grid', gap: 10 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={height} width={`${92 - (i % 3) * 9}%`} />)}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const hint = error.status === 502
    ? 'The NHL data service could not be reached. Check your internet connection, then try again.'
    : error.message;
  return (
    <div className="notice" role="alert">
      <p>{hint}</p>
      {onRetry && <button className="btn" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
