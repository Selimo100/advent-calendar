/**
 * Spotify link validation. Only plain open.spotify.com track / playlist links
 * are accepted; no credentials or Spotify API access are needed.
 */

const SPOTIFY_ID = '[A-Za-z0-9]{22}';
const LOCALE = '(?:intl-[a-z]{2}(?:-[a-zA-Z]{2})?/)?';
const QUERY = '(?:\\?[A-Za-z0-9=&_.%-]{0,200})?';

const TRACK_RE = new RegExp(`^https://open\\.spotify\\.com/${LOCALE}track/(${SPOTIFY_ID})${QUERY}$`);
const PLAYLIST_RE = new RegExp(`^https://open\\.spotify\\.com/${LOCALE}playlist/(${SPOTIFY_ID})${QUERY}$`);

export type SpotifyKind = 'track' | 'playlist';

export function parseSpotifyUrl(url: string, kind: SpotifyKind): { id: string; url: string } | null {
  const match = (kind === 'track' ? TRACK_RE : PLAYLIST_RE).exec(url.trim());
  if (!match) return null;
  const id = match[1]!;
  // Normalise: drop locale and tracking query parameters.
  return { id, url: `https://open.spotify.com/${kind}/${id}` };
}

export function spotifyEmbedUrl(kind: SpotifyKind, id: string): string {
  if (!new RegExp(`^${SPOTIFY_ID}$`).test(id)) throw new Error('Invalid Spotify id');
  return `https://open.spotify.com/embed/${kind}/${id}`;
}
