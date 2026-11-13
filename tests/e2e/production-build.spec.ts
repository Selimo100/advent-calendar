/**
 * Serves the production build (dist/) with the CSP and headers from
 * netlify.toml and checks that the page renders without CSP violations
 * and without any demo tooling.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const dist = path.resolve('dist');
const toml = readFileSync('netlify.toml', 'utf8');
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)![1]!.replace(' upgrade-insecure-requests', '');
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.skip(!existsSync(dist), 'run npm run build first');
  server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: '' } }));
    }
    const file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(dist) || !existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-security-policy': csp });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as { port: number }).port}`;
});
test.afterAll(() => server?.close());

test('production build renders under the strict CSP with no demo tooling', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(base);
  await expect(page.getByRole('button', { name: 'Unseren Kalender öffnen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo' })).toHaveCount(0);
  await expect(page.getByText('Lokaler Demo-Modus')).toHaveCount(0);
  expect(await page.evaluate(() => document.fonts.check('16px "Fraunces Variable"'))).toBe(true);
  expect(violations).toEqual([]);
  expect(requests.some((u) => u.includes('/api/demo'))).toBe(false);
});
