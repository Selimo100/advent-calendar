import { expect, test } from '@playwright/test';
import { demoState, door, login } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await demoState(request, { at: '2026-12-05T08:00:00Z', openedDays: [1, 2] });
});

test('rejects a wrong access code, then signs in', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Zugangscode', { exact: true }).fill('falscher code');
  await page.getByRole('button', { name: 'Unseren Kalender öffnen' }).click();
  await expect(page.getByText('Dieser Zugangscode passt leider nicht')).toBeVisible();
  await login(page);
  await expect(page.getByText('Türchen 5 wartet auf dich.')).toBeVisible();
});

test("opens today's door and shows the surprise in an accessible dialog", async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Zum heutigen Türchen' }).click();
  await expect(door(page, 5)).toBeFocused();
  await door(page, 5).click();
  const dialog = page.getByRole('dialog', { name: 'Ein kleiner Gutschein' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ein Abend, den du dir aussuchst.')).toBeVisible();
  await expect(door(page, 5)).toHaveAttribute('data-state', 'opened');
  // Escape closes the dialog and focus returns to the door.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(door(page, 5)).toBeFocused();
  // Reload: still opened (persisted on the server).
  await page.reload();
  await expect(door(page, 5)).toHaveAttribute('data-state', 'opened');
});

test('browser back closes the dialog', async ({ page }) => {
  await login(page);
  await door(page, 1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('list', { name: /Adventsdorf/ })).toBeVisible();
});

test('a future door explains its date and reveals nothing', async ({ page }) => {
  await login(page);
  const opened = page.waitForRequest((r) => r.url().includes('/api/doors/'), { timeout: 1500 }).catch(() => null);
  await door(page, 9).click();
  await expect(page.getByRole('status').filter({ hasText: 'Türchen 9 öffnet sich am 09.12.2026.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await opened).toBeNull();
});

test('a missed door is explained gently', async ({ page }) => {
  await login(page);
  await door(page, 3).click();
  await expect(page.getByText('Türchen 3 hatte seinen Tag am 03.12.2026.')).toBeVisible();
});

test('a previously opened memory can be revisited and navigated', async ({ page, request }) => {
  await demoState(request, { at: '2026-12-26T10:00:00Z', openedDays: [3, 4, 11] });
  await login(page);
  await expect(page.getByText('3 geöffnete Türchen sind hier für dich aufbewahrt.')).toBeVisible();
  await page.getByRole('region', { name: 'Geöffnete Türchen' }).getByRole('button', { name: /Ein gemeinsamer Moment/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Ein gemeinsamer Moment' });
  await expect(dialog).toBeVisible();
  const img = dialog.getByRole('img', { name: /zwei Spuren im Schnee/ });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  // Navigation only reaches opened doors (3 ↔ 4 ↔ 11).
  await dialog.getByRole('button', { name: 'Türchen 11' }).click();
  await expect(page.getByRole('dialog', { name: 'Ein Bild und seine Geschichte' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Türchen 12/ })).toHaveCount(0);
});

test('direct API access to a future door is denied', async ({ page }) => {
  await login(page);
  const status = await page.evaluate(async () => {
    const open = await fetch('/api/doors/6/open', { method: 'POST', headers: { 'X-Advent-Request': '1' } });
    const read = await fetch('/api/doors/6');
    return [open.status, read.status, (await read.json()).error.code];
  });
  expect(status).toEqual([403, 403, 'DOOR_NOT_OPENED']);
});

test('shows a countdown before the calendar starts', async ({ page, request }) => {
  await demoState(request, { at: '2026-11-15T10:00:00Z', openedDays: [] });
  await login(page);
  await expect(page.getByText('Der Kalender beginnt am 01.12.2026.')).toBeVisible();
  await expect(page.getByText(/Noch 15 Tage/)).toBeVisible();
  await expect(page.locator('button.house[data-state="locked"]')).toHaveCount(24);
});

test('reduced motion opens without the door animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await expect(page.locator('.snowfall')).toHaveCount(0);
  await door(page, 5).click();
  await expect(page.getByRole('dialog', { name: 'Ein kleiner Gutschein' })).toBeVisible({ timeout: 1500 });
});

test('a network failure while opening does not fake success, retry recovers', async ({ page, request }) => {
  await login(page);
  await request.post('/api/demo/fail-next');
  await door(page, 5).click();
  await expect(page.getByText('nicht erreichbar')).toBeVisible();
  await expect(door(page, 5)).toHaveAttribute('data-state', 'available');
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('dialog', { name: 'Ein kleiner Gutschein' })).toBeVisible();
});
