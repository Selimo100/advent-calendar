/**
 * The API, as a single web-standard handler: (Request) => Response.
 * Mounted by the Netlify Function (production) and by the Vite dev middleware
 * (local demo). All authorisation happens here and in calendarService.
 *
 *   POST   /api/session            sign in with the access passphrase
 *   DELETE /api/session            sign out (revokes the session)
 *   GET    /api/calendar           overview (no unopened content)
 *   POST   /api/doors/:day/open    first opening (atomic) or safe retry
 *   GET    /api/doors/:day         content of an already opened door
 *   GET    /api/media/:mediaId     302 to a short-lived signed URL
 */
import { verifyPassphrase, MAX_PASSPHRASE_LENGTH } from './auth/passphrase.ts';
import { checkLoginRateLimit, clearLoginFailures, clientBucket, recordLoginFailure } from './auth/rateLimit.ts';
import { createSession, resolveSession, revokeSessionByToken, type SessionInfo } from './auth/sessions.ts';
import { calendarRecipientId, getDoorContent, getMediaUrl, getOverview, openDoor } from './calendar/calendarService.ts';
import type { Clock } from './calendar/clock.ts';
import { isConnectionError, pgErrorCode, type Db } from './db/types.ts';
import {
  readCookie,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  sessionCookieName,
  type CookieSettings,
} from './http/cookies.ts';
import { isCsrfSafe } from './http/csrf.ts';
import { ApiError, errorResponse, json, redirect } from './http/responses.ts';
import type { MediaStorage } from './storage/types.ts';

export interface AppDeps {
  db: Db;
  clock: Clock;
  storage: MediaStorage;
  calendarId: string;
  passphraseHash: string;
  cookie: CookieSettings;
  /** Logs operational events. Never receives content, passphrases or tokens. */
  log?: (event: string, detail?: Record<string, string | number | boolean>) => void;
}

export interface RequestMeta {
  clientIp: string | null;
}

/** Raised when production configuration is missing or invalid. */
export class ConfigurationError extends Error {
  override name = 'ConfigurationError';
}

type Handler = (request: Request, deps: AppDeps, params: Record<string, string>, meta: RequestMeta) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];
function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' + path.replace(/:([a-zA-Z]+)/g, (_, key: string) => (keys.push(key), '([^/]+)')) + '/?$',
  );
  routes.push({ method, pattern, keys, handler });
}

async function requireSession(request: Request, deps: AppDeps): Promise<SessionInfo> {
  const now = await deps.clock.now(deps.db);
  const session = await resolveSession(deps.db, readCookie(request, sessionCookieName(deps.cookie)), now);
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED');
  return session;
}

function parseDay(raw: string | undefined): number {
  if (!raw || !/^\d{1,2}$/.test(raw)) throw new ApiError(400, 'INVALID_REQUEST');
  const day = Number(raw);
  if (day < 1 || day > 24) throw new ApiError(400, 'INVALID_REQUEST');
  return day;
}

async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) throw new ApiError(400, 'INVALID_REQUEST');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new ApiError(400, 'INVALID_REQUEST');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST');
  }
}

// --- Session ---------------------------------------------------------------

route('POST', '/api/session', async (request, deps, _params, meta) => {
  const body = await readJsonBody(request, 2048);
  const passphrase = (body as { passphrase?: unknown } | null)?.passphrase;
  if (typeof passphrase !== 'string' || passphrase.length === 0 || passphrase.length > MAX_PASSPHRASE_LENGTH) {
    throw new ApiError(400, 'INVALID_REQUEST');
  }
  const now = await deps.clock.now(deps.db);
  const bucket = clientBucket(meta.clientIp);
  const limit = await checkLoginRateLimit(deps.db, bucket, now);
  if (!limit.allowed) {
    deps.log?.('login_rate_limited');
    throw new ApiError(429, 'RATE_LIMITED', limit.retryAfterSeconds);
  }
  const ok = await verifyPassphrase(passphrase, deps.passphraseHash);
  if (!ok) {
    await recordLoginFailure(deps.db, bucket, now);
    deps.log?.('login_failed');
    throw new ApiError(401, 'INVALID_CREDENTIALS');
  }
  await clearLoginFailures(deps.db, bucket);
  const recipientId = await calendarRecipientId(deps.db, deps.calendarId);
  const { token } = await createSession(deps.db, recipientId, now, deps.cookie.maxAgeSeconds / 86_400);
  deps.log?.('login_succeeded');
  return json(200, { ok: true }, { 'Set-Cookie': serializeSessionCookie(token, deps.cookie) });
});

route('DELETE', '/api/session', async (request, deps) => {
  const now = await deps.clock.now(deps.db);
  await revokeSessionByToken(deps.db, readCookie(request, sessionCookieName(deps.cookie)), now);
  return json(200, { ok: true }, { 'Set-Cookie': serializeClearedSessionCookie(deps.cookie) });
});

// --- Calendar ----------------------------------------------------------------

route('GET', '/api/calendar', async (request, deps) => {
  const session = await requireSession(request, deps);
  return json(200, await getOverview(deps.db, deps.clock, deps.calendarId, session.recipientId));
});

route('POST', '/api/doors/:day/open', async (request, deps, params) => {
  const day = parseDay(params.day);
  const session = await requireSession(request, deps);
  const result = await openDoor(deps.db, deps.clock, deps.calendarId, session.recipientId, day);
  deps.log?.(result.firstOpen ? 'door_opened' : 'door_open_retry', { day });
  return json(200, result);
});

route('GET', '/api/doors/:day', async (request, deps, params) => {
  const day = parseDay(params.day);
  const session = await requireSession(request, deps);
  return json(200, await getDoorContent(deps.db, deps.calendarId, session.recipientId, day));
});

route('GET', '/api/media/:mediaId', async (request, deps, params) => {
  const session = await requireSession(request, deps);
  const url = await getMediaUrl(deps.db, deps.storage, deps.calendarId, session.recipientId, params.mediaId ?? '');
  return redirect(url);
});

// --- Dispatcher --------------------------------------------------------------

export async function handleApiRequest(
  request: Request,
  getDeps: () => AppDeps | Promise<AppDeps>,
  meta: RequestMeta,
): Promise<Response> {
  const url = new URL(request.url);
  const matching = routes
    .map((r) => ({ r, match: r.pattern.exec(url.pathname) }))
    .filter((x): x is { r: Route; match: RegExpExecArray } => x.match !== null);

  if (matching.length === 0) return errorResponse(new ApiError(404, 'NOT_FOUND'));
  const found = matching.find((x) => x.r.method === request.method);
  if (!found) {
    const allow = [...new Set(matching.map((x) => x.r.method))].join(', ');
    return errorResponse(new ApiError(405, 'METHOD_NOT_ALLOWED'), { Allow: allow });
  }
  if (!isCsrfSafe(request)) return errorResponse(new ApiError(403, 'CSRF_REJECTED'));

  const params: Record<string, string> = {};
  found.r.keys.forEach((key, i) => (params[key] = decodeURIComponent(found.match[i + 1] ?? '')));

  let deps: AppDeps | undefined;
  try {
    deps = await getDeps();
    return await found.r.handler(request, deps, params, meta);
  } catch (error) {
    if (error instanceof ApiError) {
      // Signed-out responses also clear a stale cookie.
      if (error.code === 'UNAUTHENTICATED' && deps) {
        return errorResponse(error, { 'Set-Cookie': serializeClearedSessionCookie(deps.cookie) });
      }
      return errorResponse(error);
    }
    if (error instanceof ConfigurationError) {
      console.error(`[advent] configuration error: ${error.message}`);
      return errorResponse(new ApiError(503, 'SERVER_MISCONFIGURED'));
    }
    // Log only an error class and code, never request content or parameters.
    const code = pgErrorCode(error) ?? 'unknown';
    console.error(`[advent] ${isConnectionError(error) ? 'backend unavailable' : 'internal error'} (${code})`, error instanceof Error ? error.name : '');
    return errorResponse(new ApiError(503, 'BACKEND_UNAVAILABLE'));
  }
}
