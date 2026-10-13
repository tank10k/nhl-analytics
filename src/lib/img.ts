// Route NHL images through our server (/api/image) so they are same-origin.
// Needed wherever an element may be exported as a PNG (player cards).
export function proxied(src?: string | null): string | undefined {
  if (!src) return undefined;
  return `/api/image?src=${encodeURIComponent(src)}`;
}
