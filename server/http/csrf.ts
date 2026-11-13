/**
 * CSRF protection for cookie-authenticated mutations.
 *
 * 1. Mutations must carry the custom header `X-Advent-Request: 1`. Browsers
 *    cannot add custom headers to cross-origin requests without a CORS
 *    preflight, and this API never answers preflights.
 * 2. When the browser sends `Origin` or `Sec-Fetch-Site`, they must indicate a
 *    same-origin request.
 * 3. The session cookie is SameSite=Lax as an additional layer.
 */
export const CSRF_HEADER = 'x-advent-request';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

export function isCsrfSafe(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  if (request.headers.get(CSRF_HEADER) !== '1') return false;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return true;
}
