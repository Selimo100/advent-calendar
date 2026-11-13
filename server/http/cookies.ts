export interface CookieSettings {
  /** `__Host-` prefixed + Secure in production; plain name on http://localhost. */
  secure: boolean;
  maxAgeSeconds: number;
}

export function sessionCookieName(settings: Pick<CookieSettings, 'secure'>): string {
  return settings.secure ? '__Host-advent_session' : 'advent_session';
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

export function serializeSessionCookie(token: string, settings: CookieSettings): string {
  const attributes = [
    `${sessionCookieName(settings)}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${settings.maxAgeSeconds}`,
  ];
  if (settings.secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function serializeClearedSessionCookie(settings: CookieSettings): string {
  const attributes = [`${sessionCookieName(settings)}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (settings.secure) attributes.push('Secure');
  return attributes.join('; ');
}
