import { useCallback, useEffect, useState } from 'react';

// Small client cache in front of /api: pages that ask for the same data share one
// request, and coming back to a page within the TTL is instant. The server has its
// own longer cache, so this only needs to cover navigation within a session.

const TTL = 2 * 60 * 1000;
const cache = new Map<string, { t: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchApi<T>(path: string, force = false): Promise<T> {
  const hit = cache.get(path);
  if (!force && hit && Date.now() - hit.t < TTL) return hit.data as T;
  const running = inflight.get(path);
  if (running) return running as Promise<T>;

  const p = (async () => {
    try {
      const res = await fetch(path, { headers: { Accept: 'application/json' } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, body.error || `Request failed (${res.status})`);
      cache.set(path, { t: Date.now(), data: body });
      return body as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, 'The local server is not responding. Check that npm run dev is still running.');
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  retry: () => void;
}

/** Fetch `path` (or nothing when null) and re-fetch whenever it changes. */
export function useApi<T>(path: string | null): ApiState<T> {
  const cached = path ? (cache.get(path)?.data as T | undefined) : undefined;
  const [state, setState] = useState<{ path: string | null; data?: T; error?: ApiError }>({ path, data: cached });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((s) => (s.path === path && s.data ? s : { path, data: cache.get(path)?.data as T | undefined }));
    fetchApi<T>(path, nonce > 0).then(
      (data) => live && setState({ path, data }),
      (error: ApiError) => live && setState({ path, error }),
    );
    return () => { live = false; };
  }, [path, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.path === path;
  return {
    data: current ? state.data : cached,
    error: current ? state.error : undefined,
    loading: Boolean(path) && (!current || (!state.data && !state.error)),
    retry,
  };
}

/** Fetch several paths at once (a list that can change length); results keep the input order. */
export function useApiMany<T>(paths: string[]): { data: (T | undefined)[]; loading: boolean } {
  const key = paths.join('|');
  const [state, setState] = useState<{ key: string; data: (T | undefined)[]; done: boolean }>({ key: '', data: [], done: true });

  useEffect(() => {
    let live = true;
    const list = key ? key.split('|') : [];
    setState((s) => (s.key === key ? s : { key, data: list.map((p) => cache.get(p)?.data as T | undefined), done: false }));
    // A failed path resolves to undefined so one bad request doesn't hold up the rest.
    Promise.all(list.map((p) => fetchApi<T>(p).catch(() => undefined))).then((data) => {
      if (live) setState({ key, data, done: true });
    });
    return () => { live = false; };
  }, [key]);

  const current = state.key === key;
  return {
    data: current ? state.data : paths.map((p) => cache.get(p)?.data as T | undefined),
    loading: !current || !state.done,
  };
}
