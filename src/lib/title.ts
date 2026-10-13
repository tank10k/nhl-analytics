import { useEffect } from 'react';

/** Sets the browser tab title for a page: "Name · NHL Analytics". */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · NHL Analytics` : 'NHL Analytics';
  }, [title]);
}
