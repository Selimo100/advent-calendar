import type { ApiErrorBody, ApiErrorCode, CalendarOverview, DoorContent, OpenDoorResult } from '../../shared/api.ts';

export type FailureCode = ApiErrorCode | 'NETWORK' | 'TIMEOUT';

export class ApiFailure extends Error {
  override name = 'ApiFailure';
  constructor(
    readonly code: FailureCode,
    readonly status: number,
    readonly serverMessage?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
  get isNetwork() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.method && init.method !== 'GET') headers.set('X-Advent-Request', '1');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiFailure('NETWORK', 0);
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === 'TimeoutError';
    throw new ApiFailure(timeout ? 'TIMEOUT' : 'NETWORK', 0);
  }
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiFailure(err?.code ?? 'BACKEND_UNAVAILABLE', response.status, err?.message, err?.retryAfterSeconds);
  }
  return body as T;
}

export const api = {
  login: (passphrase: string) =>
    request<{ ok: true }>('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    }),
  logout: () => request<{ ok: true }>('/api/session', { method: 'DELETE' }),
  calendar: () => request<CalendarOverview>('/api/calendar'),
  openDoor: (day: number) => request<OpenDoorResult>(`/api/doors/${day}/open`, { method: 'POST' }),
  door: (day: number) => request<DoorContent>(`/api/doors/${day}`),
};
