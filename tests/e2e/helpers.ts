import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const DEMO_PASSPHRASE = 'lebkuchen-im-schnee';

export async function demoState(request: APIRequestContext, opts: { at: string; openedDays: number[] }) {
  await request.post('/api/demo/latency', { data: { ms: 0 } });
  await request.post('/api/demo/clock', { data: { at: opts.at } });
  await request.post('/api/demo/history', { data: { openedDays: opts.openedDays } });
}

export async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Zugangscode', { exact: true }).fill(DEMO_PASSPHRASE);
  await page.getByRole('button', { name: 'Unseren Kalender öffnen' }).click();
  await expect(page.getByRole('list', { name: /Adventsdorf/ })).toBeVisible();
}

export const door = (page: Page, day: number) => page.locator(`button.house[data-day="${day}"]`);
