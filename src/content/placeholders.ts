/**
 * Placeholder detection for the readiness report. Placeholders are uppercase
 * tokens in square brackets, e.g. [NAME], [YOUR MEMORY], [SPOTIFY TRACK URL].
 */
export const PLACEHOLDER_RE = /\[[A-ZÄÖÜ][A-ZÄÖÜ0-9 _/-]*\]/g;

export interface PlaceholderHit {
  path: string;
  token: string;
}

export function isPlaceholder(value: string): boolean {
  return new RegExp(`^${PLACEHOLDER_RE.source}$`).test(value.trim());
}

/** Lists every placeholder token by JSON path. Never returns surrounding text. */
export function findPlaceholders(value: unknown, path = ''): PlaceholderHit[] {
  if (typeof value === 'string') {
    return [...value.matchAll(PLACEHOLDER_RE)].map((m) => ({ path, token: m[0] }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findPlaceholders(item, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      findPlaceholders(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}
