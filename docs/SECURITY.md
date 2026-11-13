# Security and privacy notes

## Goal

Nothing about a door is revealed before its date: no title, content type,
text, song, link or media. Opened content is delivered to the recipient's
browser. From then on it can be copied or screenshotted; that is out of
scope.

## Enforcement points

| Concern | Where | How |
| --- | --- | --- |
| Opening rules | `server/calendar/openingPolicy.ts` | single STRICT_DATE policy, pure functions |
| Authoritative time | `server/calendar/clock.ts` | production uses `select now()` inside the opening transaction; no override exists |
| Atomic first opening | `calendarService.openDoor` | one transaction: DB time → row lock on recipient → idempotency check → policy → content readiness → insert |
| Database invariants | migration | `unique (recipient, calendar, day)`, `unique (recipient, calendar, local_date)`, `check local_date = (opened_at at time zone 'Europe/Zurich')::date`, openings immutable, calendar year immutable |
| Content access | `getDoorContent` | requires an existing opening; never creates one |
| Media access | `getMediaUrl` | media id → must belong to an opened, publishable door → 10-minute signed URL; same 404 for "unknown" and "not allowed" |
| Overview | `getOverview` | only `day` + `state` per unopened door; titles only for opened doors |
| Identity | `server/auth/sessions.ts` | 256-bit random token in an HttpOnly, Secure, SameSite=Lax `__Host-` cookie; only SHA-256 hashes stored; 60-day expiry; logout revokes |
| Passphrase | `server/auth/passphrase.ts` | scrypt (N=2^15, r=8, p=1), hash only in env; no default production passphrase |
| Brute force | `server/auth/rateLimit.ts` | durable in Postgres: 8 failures / 15 min per hashed client IP, 100 / hour globally |
| CSRF | `server/http/csrf.ts` | custom header required for mutations, `Origin` / `Sec-Fetch-Site` must be same-origin |
| Caching | `server/http/responses.ts` | `private, no-store`, `Netlify-CDN-Cache-Control: no-store`, `Vary: Cookie` on every API response; no service worker |
| Database exposure | migration | private `advent` schema not exposed via the Data API, RLS on every table without policies, all privileges revoked from API roles, functions with fixed `search_path` |
| Storage exposure | migration | bucket `public = false`, no storage policies for API roles |
| Static output | `scripts/check-public-output.ts` (runs after every build) | fails on source maps, secret patterns or values, demo tooling, any example or private calendar text, or tracked private files |
| Headers | `netlify.toml` | strict CSP (self-hosted fonts, only Spotify frames, only Supabase images and media), HSTS, frame-ancestors none, noindex |

## Demo mode cannot leak into production

- The Netlify Function (`netlify/functions/api.mts`) imports only
  `server/production.ts`. That module uses the database clock and refuses to
  start without complete configuration (`503 SERVER_MISCONFIGURED`).
- The demo backend (`tools/demo/`) is loaded only by the Vite dev server via
  `ssrLoadModule`. It is not part of the function bundle; this was checked by
  bundling the function and searching it.
- The demo panel is imported behind `import.meta.env.DEV` and removed from
  production builds. The build check fails if `/api/demo` or `DemoPanel`
  appears in `dist/`.
- There are no query parameters, local storage flags, keyboard shortcuts or
  unauthenticated endpoints that influence time or access in production.

## Logging

Logs contain only event names (for example `door_opened` with the day number),
error classes and Postgres error codes. They never contain content,
passphrases, tokens, cookies or IP addresses. Login failures are stored as
SHA-256 hashes of the client IP and deleted after two days.

## What is not protected

- Anyone with the passphrase can act as the recipient.
- Someone with access to the Supabase project, the Netlify environment
  variables or `content/private/` can read everything.
- Opened content can be saved by the recipient.
