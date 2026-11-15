/**
 * Checks the production build as it will be served by Netlify: the real
 * static files, the CSP and headers from netlify.toml, no development
 * tooling, and no request to any backend.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { door, titleOf, visit, YEAR, zurichInstant } from './helpers.ts';

const dist = path.resolve('dist');
const toml = readFileSync('netlify.toml', 'utf8');
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)![1]!.replace(' upgrade-insecure-requests', '');
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.txt': 'text/plain',
  '.json': 'application/json',
};
let server: Server;
let base = '';
/** Paths requested that the static site does not actually contain. */
const notFound: string[] = [];

test.beforeAll(async () => {
  test.skip(!existsSync(dist), 'run npm run build first');
  server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    // No SPA fallback: a missing file must be a real 404, never index.html.
    const file = path.join(dist, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!file.startsWith(dist) || !existsSync(file)) {
      notFound.push(url.pathname);
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, {
      'content-type': types[path.extname(file)] ?? 'application/octet-stream',
      'content-security-policy': csp,
      'x-robots-tag': 'noindex, nofollow',
    });
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as { port: number }).port}`;
});

test.afterAll(() => server?.close());

test('renders under the strict CSP with no development tooling and no backend calls', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });

  await page.clock.install({ time: zurichInstant(YEAR, 12, 6) });
  await page.goto(base);

  await expect(page.getByRole('list', { name: /Adventsdorf/ })).toBeVisible();
  await expect(page.locator('button.house')).toHaveCount(24);
  // No dev panel, no login screen.
  await expect(page.getByRole('button', { name: 'Dev' })).toHaveCount(0);
  await expect(page.getByText('Entwicklungs-Vorschau')).toHaveCount(0);
  await expect(page.getByLabel(/Zugangscode/)).toHaveCount(0);
  // Self-hosted fonts load.
  expect(await page.evaluate(() => document.fonts.check('16px "Fraunces Variable"'))).toBe(true);

  // Open door 6 and start the game, so the lazily loaded chunk is exercised
  // under the same CSP.
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  await page.getByRole('button', { name: 'Los geht es' }).click();
  await expect(page.getByRole('img', { name: 'Der Samichlaus im Winterwald' })).toBeVisible();
  await page.waitForTimeout(600);

  expect(violations).toEqual([]);
  expect(requests.filter((url) => url.includes('/api/'))).toEqual([]);
  expect(failures).toEqual([]);
  expect(notFound).toEqual([]);
  // Everything comes from the site itself; nothing from a third party.
  const external = requests.filter((url) => !url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:'));
  expect(external).toEqual([]);
});

test('the built files contain no backend references', async () => {
  const assets = path.join(dist, 'assets');
  const files = existsSync(assets) ? readFileSync : readFileSync;
  void files;
  const { readdirSync } = await import('node:fs');
  const texts = readdirSync(assets)
    .filter((name) => /\.(js|css)$/.test(name))
    .map((name) => readFileSync(path.join(assets, name), 'utf8'));
  const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
  const all = [...texts, html].join('\n');
  for (const forbidden of [
    '/api/',
    'supabase',
    'SUPABASE',
    'DATABASE_URL',
    'postgres://',
    'pglite',
    'passphrase',
    'Zugangscode',
    'DevPanel',
    'Entwicklungs-Vorschau',
    'advent:dev',
  ]) {
    expect(all, `built output must not contain "${forbidden}"`).not.toContain(forbidden);
  }
  // No source maps in the public output.
  const { readdirSync: readdir } = await import('node:fs');
  expect(readdir(assets).filter((name) => name.endsWith('.map'))).toEqual([]);
});

test('a missing media or data path returns 404 rather than the app', async ({ page }) => {
  const response = await page.request.get(`${base}/media/photos/does-not-exist.jpg`);
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain('<div id="root">');
  notFound.length = 0;
});

test('the app works with the device clock only, offline after the first load', async ({ page, context }) => {
  await page.clock.install({ time: zurichInstant(YEAR, 12, 5) });
  await page.goto(base);
  await expect(page.locator('button.house')).toHaveCount(24);
  // Cut the network: the date policy and local progress must keep working.
  await context.setOffline(true);
  await door(page, 5).click();
  await expect(page.getByRole('dialog', { name: titleOf(5) })).toBeVisible();
  await context.setOffline(false);
  notFound.length = 0;
});

test('the dev-only date simulation has no production entry point', async ({ page }) => {
  await page.clock.install({ time: zurichInstant(YEAR, 12, 5) });
  // A query parameter must not be able to move the date.
  await page.goto(`${base}/?at=2026-12-24T10:00:00Z&date=2026-12-24&day=24`);
  await expect(page.getByText('Heute · 05.12.2026')).toBeVisible();
  await expect(door(page, 24)).toHaveAttribute('data-state', 'locked');

  // Writing the dev key does nothing in a production build.
  await page.evaluate(() => window.localStorage.setItem('advent:dev:now', '2026-12-24T09:00:00.000Z'));
  await page.reload();
  await expect(page.getByText('Heute · 05.12.2026')).toBeVisible();
  notFound.length = 0;
});

test('visit helper also works against the preview server', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await expect(page.locator('button.house')).toHaveCount(24);
});
