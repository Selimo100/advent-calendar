import { API_ERROR_MESSAGES, type ApiErrorBody, type ApiErrorCode } from '../../shared/api.ts';

export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

/**
 * Headers for every API response. Responses are personal and must never be
 * stored by a shared cache / CDN, nor by the browser's back-forward cache.
 */
export const SENSITIVE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Netlify-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

export function json(status: number, body: unknown, headers: HeadersInit = {}): Response {
  const h = new Headers(SENSITIVE_HEADERS);
  h.set('Content-Type', 'application/json; charset=utf-8');
  new Headers(headers).forEach((v, k) => h.append(k, v));
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: h });
}

export function errorResponse(error: ApiError, headers: HeadersInit = {}): Response {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: API_ERROR_MESSAGES[error.code],
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    },
  };
  const h = new Headers(headers);
  if (error.retryAfterSeconds) h.set('Retry-After', String(error.retryAfterSeconds));
  return json(error.status, body, h);
}

export function redirect(location: string): Response {
  const h = new Headers(SENSITIVE_HEADERS);
  h.set('Location', location);
  return new Response(null, { status: 302, headers: h });
}
