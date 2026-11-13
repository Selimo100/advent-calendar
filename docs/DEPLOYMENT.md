# Deployment checklist (GitHub → Netlify, Supabase)

Nothing in this repository has been connected to a real GitHub, Supabase or
Netlify account yet. These are the owner steps. Plans and pricing of the
providers change; check their current terms yourself.

The steps below were written without access to the providers' current
dashboards. Menu names may differ slightly; the concepts (connection
strings, secret keys, environment variable scopes and deploy contexts) are
what matters.

## 0. Prerequisites

- Node.js 22.12+ and npm.
- A Supabase account, a Netlify account, a GitHub account.

## 1. Create the Supabase project

1. Create a new project. Choose a region close to Zurich (e.g. Frankfurt / Zurich if offered).
2. Note the **database password**.
3. Collect, from the project's settings:
   - **Project URL** → `SUPABASE_URL` (`https://<ref>.supabase.co`)
   - **Secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY`
     (or the legacy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`)
   - **Connection string, transaction pooler** (port **6543**) → `DATABASE_URL`
   - **Connection string, session pooler or direct** (port **5432**) → `DATABASE_MIGRATION_URL`
4. Leave the Data API's exposed schemas as they are (`public`, `graphql_public`).
   The calendar uses its own schema `advent`, which must **not** be exposed.

## 2. Configure credentials locally

```bash
cp .env.example .env.local     # gitignored
# fill in DATABASE_URL, DATABASE_MIGRATION_URL, SUPABASE_URL, SUPABASE_SECRET_KEY
```

## 3. Apply the migrations (schema + private bucket)

```bash
npm run db:migrate
```

This creates the `advent` schema (RLS enabled, all privileges revoked from
`anon`, `authenticated`, `service_role` and `public`) and the private bucket
`advent-private` (`public = false`, no storage policies). Running it again is
safe.

Alternative: paste the files in `supabase/migrations/` in order into the
Supabase SQL editor. Use one method consistently.

## 4. Create the access passphrase hash

Choose a long passphrase (four or five unrelated words work well).

```bash
npm run passphrase:hash
```

Copy the printed `scrypt$v1$…` value. It goes into Netlify as
`ADVENT_PASSPHRASE_HASH`. Give her the passphrase in person or in a card.

## 5. Write and import the calendar content

```bash
npm run content:init-private          # creates content/private/ (gitignored)
# edit content/private/calendar.ts, add photos/voice files to content/private/media/
npm run content:validate -- --source private
npm run content:import -- --source private --dry-run
npm run content:import -- --source private
```

Doors that still contain placeholders are imported as **not publishable**:
they cannot be opened, and on their day she sees “wird gerade noch liebevoll
vorbereitet”. Details: [CONTENT.md](CONTENT.md).

## 6. Push the code to GitHub

```bash
git add -A
git status            # content/private, .env.local, backups must NOT appear
git commit -m "Advent calendar"
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

`npm run build` also fails if private files are tracked by git or if any
calendar text or secret ends up in `dist/`.

## 7. Connect the repository to Netlify

1. Add a new site from the GitHub repository.
2. The build settings come from `netlify.toml` (`npm run build`, publish `dist`,
   functions in `netlify/functions`).

## 8. Environment variables (Netlify)

Set these under **Site configuration → Environment variables**. Use scope
**Functions** (they are not needed at build time), mark them as secret where
the UI offers it, and set values **per deploy context**:

| Variable | Production | Deploy previews / branch deploys |
| --- | --- | --- |
| `DATABASE_URL` | production transaction-pooler string | a **separate** Supabase project |
| `SUPABASE_URL` | production project URL | separate project |
| `SUPABASE_SECRET_KEY` | production secret key | separate project's key |
| `ADVENT_CALENDAR_ID` | `advent-2026` | `advent-2026` |
| `ADVENT_PASSPHRASE_HASH` | hash of her passphrase | hash of a different test passphrase |
| `ADVENT_MEDIA_BUCKET` | (optional) `advent-private` | (optional) |

Never prefix any of these with `VITE_`. Vite would put such variables into
the public JavaScript bundle.

### Keep previews away from production data

- Give the deploy-preview and branch-deploy contexts **their own** Supabase
  project with fictional content (`npm run content:import -- --source example --allow-placeholders`
  using that project's credentials). Alternatively, give those contexts no
  values at all: the function then answers `503 SERVER_MISCONFIGURED` rather
  than falling back to anything.
- Keep the GitHub repository private, or disable deploy previews for pull
  requests from forks. Check Netlify's setting for environment variables in
  deploys from untrusted contributors, and make sure production secrets are
  **not** available to them.

## 9. Deploy and verify

Trigger a deploy, then:

```bash
SITE_URL=https://<your-site>.netlify.app \
ADVENT_VERIFY_PASSPHRASE='<her passphrase>' \
npm run verify:deployment -- --url https://<your-site>.netlify.app
```

It checks the following:

- The API requires a session and is `no-store`.
- CSRF protection is active.
- No secrets or source maps are published.
- Bucket objects are not publicly readable.
- The `advent` schema is not reachable through the Data API with the public key. Set `SUPABASE_PUBLISHABLE_KEY` to include this check.
- Sign-in works, and the server's Zurich date is correct.

Manual checks on her phone:

1. Sign in, then close and reopen Safari. You should still be signed in.
2. Before 1 December, every door is locked and a countdown is shown.
3. On 1 December, door 1 opens. Then open the site in a private tab and sign in again: door 1 is still open.
4. Tap a future door. It explains its date and shows nothing else.

## 10. During December

- Content changes: edit `content/private/`, then `npm run content:import -- --source private`.
  This is safe at any time and never touches opening history.
- Lost device or passphrase shared by mistake: see "Rotate the access passphrase"
  in [CONTENT.md](CONTENT.md).
- Backups: `npm run content:backup`.
