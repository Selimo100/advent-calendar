# Owner workflow: writing and updating the calendar

All personal content lives in **`content/private/`**, which is gitignored:

```
content/private/
  calendar.ts      settings + 24 doors (TypeScript, validated)
  media/           photos (.jpg .png .webp) and voice messages (.m4a .mp3 .ogg .webm .wav)
```

Create it once from the fictional example:

```bash
npm run content:init-private
```

Then work in this loop:

```bash
npm run content:validate -- --source private            # schema + readiness report
npm run content:import   -- --source private --dry-run  # what would change
npm run content:import   -- --source private            # apply
```

The importer:

- Validates all 24 doors before writing anything.
- Is keyed by calendar id and door day, so running it again is safe.
- Never changes opening history or sessions.
- Never deletes anything unless you pass `--prune`. That removes media you no longer reference.
- Re-encodes photos to WebP (max. 1600 px), applies the EXIF orientation and **removes metadata**, including GPS.
- Stores media under random, content-addressed paths. Your file names never reach the browser.
- Marks a door as *publishable* only when it contains no `[PLACEHOLDER]` and no `placeholder-*` media.

The validator and importer print only field paths, placeholder tokens and
file references, never your text.

## Writing style

- Standard German. Use "ss", never the sharp s. ä, ö and ü are fine.
- Plain text. Inside paragraphs you may use `**bold**` and `*italic*`; HTML is never interpreted.
- In `date` fields, write dates as `YYYY-MM-DD`; they are shown as `DD.MM.YYYY`.

## Change names, greeting and signature

These are in `settings` in `content/private/calendar.ts`:

```ts
settings: {
  recipientName: 'Lena',
  senderName: 'Tom',
  title: '24 kleine Gründe, warum du mir wichtig bist',
  greeting: 'Hallo Lena',
  intro: 'In diesem kleinen Dorf …',
  signature: 'Von Herzen, Tom',
  closingMessage: 'Die Adventszeit ist vorbei …',
  footerNote: '…',   // optional
},
```

They are only delivered after sign-in. The texts on the **login screen** are
public and live in `src/config/site.ts`. Never put names there.

## Change one message

Edit the door in `calendar.ts`, run `content:validate`, then `content:import`.
If the door was already opened, she sees the new text the next time it loads.

## Replace a photo

Put the new file in `content/private/media/`, for example `photos/day-04.jpg`, and point the door at it:

```ts
{ type: 'memory', photos: [{ file: 'photos/day-04.jpg', alt: 'Wir beide am Seeufer im Januar' }], story: ['…'] }
```

Always write a meaningful `alt` text; screen readers read it aloud. Then
import. Add `--prune` if you want the old object deleted from storage.

## Add a song and its story

```ts
{
  type: 'song',
  trackTitle: 'Titel',
  artist: 'Interpret',
  spotifyUrl: 'https://open.spotify.com/track/<22-character id>',
  intro: ['Ein Satz zur Einleitung.'],                     // optional
  whyItRemindsUs: ['Warum dich das Lied an euch erinnert.'],
  artwork: { file: 'covers/lied.jpg', alt: 'Cover' },      // optional; only use artwork you may use
}
```

To get the link, use **Share → Copy song link** in Spotify. Only
`open.spotify.com/track/…` links are accepted (`playlist` for the playlist
block). No Spotify account or API key is needed. The embedded player loads
only after she taps “Player hier laden”.

## Add a voice message

Record it, for example as `.m4a` with the iPhone's Voice Memos app, and save it as `content/private/media/audio/day-06.m4a`:

```ts
{ type: 'voice', title: 'Für dich aufgenommen', audio: { file: 'audio/day-06.m4a' }, durationLabel: '1:12',
  transcript: ['Optional: was du sagst, zum Mitlesen.'] }
```

The message never plays automatically.

## Block types

| Type | Use for |
| --- | --- |
| `letter` | a message (title, paragraphs, signature) |
| `memory` | 1–6 photos with alt text, date or `dateLabel`, location, story |
| `song` | one track with your story |
| `playlist` | a Spotify playlist with highlights |
| `voucher` | a gift voucher (title, description, conditions, note) |
| `voice` | a private voice message with optional transcript |
| `activity` | a small shared invitation or challenge |
| `reasons` | a numbered list of reasons |
| `finalLetter` | the special layout for day 24, with a final surprise to unveil |

A door can combine up to 8 blocks, for example a `letter` plus a `memory`.

## Readiness report

`npm run content:validate -- --source private` lists each door as
`✓ ready` or `… needs work`, with the exact paths of placeholders and
missing files. Add `--strict` to get a non-zero exit code until everything is ready.

## Colours, fonts and design

- Colours, shadows and motion: the `@theme` block in `src/styles/index.css`.
  `npm test` checks the contrast of the main text/background pairs.
- House shapes and the order of houses in the village: `src/components/village/houses.ts`.

## Set the calendar year (or make a new calendar next year)

A calendar's year is fixed once imported; the database refuses to change it.
For a new year, keep the old calendar and create a new one:

1. In `content/private/calendar.ts`, set `calendarId: 'advent-2027'` and `year: 2027`. Keep the same `recipientSlug`.
2. `npm run content:import -- --source private`
3. In Netlify, set `ADVENT_CALENDAR_ID=advent-2027` and redeploy.

The 2026 calendar, including its opening history, stays in the database untouched.

## Rotate the access passphrase

1. `npm run passphrase:hash`, then set the new `ADVENT_PASSPHRASE_HASH` in Netlify and redeploy.
   Environment variable changes apply to new deploys.
2. `npm run sessions:revoke` signs out every device.
3. Give her the new passphrase.

## Revoke sessions

`npm run sessions:revoke` signs out all devices. Opening history is not affected.

## Back up personal content

- `content/private/` is your source of truth for the texts. Keep a copy somewhere private, not in the public repository.
- `npm run content:backup` downloads the database rows (calendars, doors, media metadata, opening history) and all media objects to `backups/<timestamp>/`, which is gitignored.
