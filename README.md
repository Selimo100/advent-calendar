# Advent calendar — “24 kleine Gründe, warum du mir wichtig bist”

A private, mobile-first Advent calendar: a snowy village with 24 houses, one
door per December day. Doors can only be opened on their own date. The server
enforces that rule (Europe/Zurich, server clock), the opening history is
stored in Postgres, and surprises stay private until they are opened.

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS v4 (design tokens in
  `src/styles/index.css`), CSS 3D door animation, self-hosted fonts.
- **API:** one Netlify Function (`netlify/functions/api.mts`) serving `/api/*`.
- **Data:** Supabase Postgres (private `advent` schema, RLS on, no API-role
  grants) and a private Supabase Storage bucket for photos and voice messages.
- **No** service worker, analytics, public registration or admin panel.

The repository contains only code, schema and **fictional** example content.
It is safe to make public. Your real messages and media live in
`content/private/` (gitignored) and in your Supabase project.

## Quick start (local demo, no accounts needed)

```bash
npm install
npm run dev            # http://localhost:5173
```

### Dev mode (hidden)

Tap the **top-left corner five times** quickly, then enter the dev password.
This works locally and on the deployed site (handy for checking on a phone).
The dev panel (top right) lets you simulate any date, preset opened/missed
doors, jump to game checkpoints and force reduced motion.

- Set or change the password: `npm run dev:password`, then commit
  `src/dev/devPassword.ts` and deploy. Only a salted hash is stored.
- Dev mode uses its own storage (`advent:dev:…`), so real progress is never
  touched. It lasts for the current tab; "Dev-Modus beenden" leaves it.
- It is a static site: the password check runs in the browser. It keeps the
  panel out of the way; it is not access control.

Doors open at **00:01** Zurich time (`DOOR_OPENS_AFTER_MINUTES` in
`src/lib/calendarPolicy.ts`).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local demo (fictional content, simulated clock) |
| `npm run dev:netlify` | `netlify dev` with the real function and your `.env` (requires the Netlify CLI) |
| `npm run typecheck` | TypeScript, all projects |
| `npm test` | Unit tests + database integration tests (starts a real local PostgreSQL) |
| `npm run test:e2e` | Playwright end-to-end tests (mobile WebKit + Chromium, production-build CSP check, screenshots) |
| `npm run build` | Production build + public-output privacy check |
| `npm run content:init-private` | Create `content/private/` from the example |
| `npm run content:validate -- --source private` | Schema validation + readiness report (`--strict` fails unless all 24 doors are ready) |
| `npm run content:import -- --source private --dry-run` | Show planned changes, write nothing |
| `npm run content:import -- --source private` | Upload media and upsert content (idempotent) |
| `npm run db:migrate` | Apply SQL migrations to `DATABASE_URL` |
| `npm run passphrase:hash` | Create `ADVENT_PASSPHRASE_HASH` for a new access passphrase |
| `npm run sessions:revoke` | Sign out every device |
| `npm run content:backup` | Download database rows + media to `backups/` (gitignored) |
| `npm run verify:deployment -- --url https://…` | Read-only checks against the live site and Supabase |

The first `npm run test:e2e` needs browsers: `npx playwright install chromium webkit`.

## Where things live

```
content/example/        fictional example calendar + placeholder media (committed)
content/private/        YOUR calendar + media (gitignored; create with content:init-private)
shared/                 code shared by client and server (dates, content schema, API types)
server/                 API: routing, sessions, rate limiting, opening policy, storage
  calendar/openingPolicy.ts   THE opening rules (STRICT_DATE)
  calendar/calendarService.ts atomic opening transaction, content + media access
netlify/functions/api.mts     production entry point (/api/*)
supabase/migrations/    SQL schema, RLS, grants, private bucket
src/                    React app (village, doors, dialog, content blocks)
src/config/site.ts      public pre-login texts (no names!)
src/styles/index.css    colour, type, shadow and motion tokens
tools/content/          validation, readiness report, media processing, importer
tools/demo/             local demo backend (dev only)
scripts/                owner CLIs and the build privacy check
tests/                  unit, db (real Postgres), e2e (Playwright)
docs/                   deployment, content workflow, security notes
```

## Personalising

See **[docs/CONTENT.md](docs/CONTENT.md)** for the full owner workflow: names,
greeting and signature, each door's content, photos, songs, voice messages,
the calendar year, colours, and backups.

## Deploying

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Supabase project,
migrations, private bucket, passphrase hash, content import, GitHub, Netlify
environment variables (Functions scope, per deploy context), and the
post-deploy checks.

## The calendar rules (STRICT_DATE)

- Door *N* can be opened for the first time only on *N* December of the
  configured year, by the server's clock in Europe/Zurich.
- One new door per day. Opened doors stay readable forever, on any device.
- Missed doors stay closed (“eingeschneit”); future doors reveal nothing.
- Before 1 December the village shows a countdown; after 24 December opened
  doors stay available with a closing message.

The rules live in `server/calendar/openingPolicy.ts`, which also documents how
to add a deliberate catch-up policy later.

## Honest limitations

- Once a door has been opened, its content is delivered to the browser. It can
  then be saved or screenshotted. The protection goal is that **nothing is
  revealed before its date**, not that viewed content cannot be copied.
- Spotify embeds play full tracks only for signed-in Spotify users; otherwise
  Spotify shows a preview. The card always works with the plain link.
- The access passphrase protects a single shared identity (the recipient).
  Anyone who knows the passphrase is treated as her.
