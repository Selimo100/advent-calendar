import { expect, test } from '@playwright/test';
import { contentOf, door, readProgress, titleOf, visit, YEAR, zurichInstant } from './helpers.ts';

test('opens straight into the calendar, with no login screen', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await expect(page.getByRole('list', { name: /Adventsdorf/ })).toBeVisible();
  await expect(page.locator('button.house')).toHaveCount(24);
  await expect(page.getByLabel(/Zugangscode/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Anmelden|Abmelden/ })).toHaveCount(0);
});

test('shows a countdown and a welcome before December', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 11, 15, 10) });
  await expect(page.getByText(`Der Kalender beginnt am 01.12.${YEAR}.`)).toBeVisible();
  await expect(page.getByText(/Noch 15 Tage/)).toBeVisible();
  await expect(page.locator('button.house[data-state="locked"]')).toHaveCount(24);
  await expect(page.getByRole('button', { name: 'Zum heutigen Türchen' })).toHaveCount(0);
});

function voucherTitle(day: number): string {
  const block = contentOf(day).blocks.find((b) => b.type === 'voucher');
  if (!block || block.type !== 'voucher') throw new Error(`Door ${day} has no voucher`);
  return block.title;
}

function firstPhotoAlt(day: number): string {
  const block = contentOf(day).blocks.find((b) => b.type === 'memory');
  const photo = block?.type === 'memory' ? block.photos?.[0] : undefined;
  if (!photo) throw new Error(`Door ${day} has no memory photo`);
  return photo.alt;
}

test("opens today's door and shows the surprise in an accessible dialog", async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await expect(page.getByText('Türchen 5 wartet auf dich.')).toBeVisible();
  await page.getByRole('button', { name: 'Zum heutigen Türchen' }).click();
  await expect(door(page, 5)).toBeFocused();
  await door(page, 5).click();
  const dialog = page.getByRole('dialog', { name: titleOf(5) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(voucherTitle(5))).toBeVisible();
  await expect(door(page, 5)).toHaveAttribute('data-state', 'opened');

  // Escape closes the dialog and focus returns to the door.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(door(page, 5)).toBeFocused();

  // The opening was recorded locally, with its Zurich date.
  const progress = await readProgress(page);
  expect((progress?.opened as Record<string, { date: string }>)['5']!.date).toBe(`${YEAR}-12-05`);
});

test('keeps opened doors after a reload', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await door(page, 5).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(door(page, 5)).toHaveAttribute('data-state', 'opened');
  await expect(page.getByText('Heute hast du Türchen 5 geöffnet.')).toBeVisible();
});

test('browser back closes the dialog', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5), progress: { opened: [1] } });
  await door(page, 1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('list', { name: /Adventsdorf/ })).toBeVisible();
});

test('a future door explains its date and reveals nothing', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await door(page, 9).click();
  await expect(page.getByRole('status').filter({ hasText: `Türchen 9 öffnet sich am 09.12.${YEAR}.` })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(door(page, 9)).toHaveAttribute('data-state', 'locked');
});

test('a missed door stays closed and is explained gently', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await expect(door(page, 3)).toHaveAttribute('data-state', 'missed');
  await door(page, 3).click();
  await expect(page.getByText(`Türchen 3 hatte seinen Tag am 03.12.${YEAR}.`)).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('only one new door per calendar date', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await door(page, 5).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  // Reading an older door does not consume anything, and no other door opens.
  await expect(door(page, 4)).toHaveAttribute('data-state', 'missed');
  await door(page, 4).click();
  await expect(page.getByText(`Türchen 4 hatte seinen Tag am 04.12.${YEAR}.`)).toBeVisible();
});

test('revisiting an opened door does not use up the day', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5), progress: { opened: [1, 2] } });
  await door(page, 1).click();
  await expect(page.getByRole('dialog', { name: titleOf(1) })).toBeVisible();
  await page.keyboard.press('Escape');
  // Today's door is still available after reading an old memory.
  await expect(door(page, 5)).toHaveAttribute('data-state', 'available');
  await door(page, 5).click();
  await expect(page.getByRole('dialog', { name: titleOf(5) })).toBeVisible();
});

test('navigation in the dialog only reaches opened doors', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 26, 10), progress: { opened: [3, 4, 11] } });
  await expect(page.getByText('3 geöffnete Türchen sind hier für dich aufbewahrt.')).toBeVisible();
  await page.getByRole('region', { name: 'Geöffnete Türchen' }).getByRole('button', { name: titleOf(4) }).click();
  const dialog = page.getByRole('dialog', { name: titleOf(4) });
  await expect(dialog).toBeVisible();
  const image = dialog.getByRole('img', { name: firstPhotoAlt(4) });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Türchen 11' }).click();
  await expect(page.getByRole('dialog', { name: titleOf(11) })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Türchen 12/ })).toHaveCount(0);
});

test('after 24 December opened doors stay readable and missed ones stay closed', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 26, 10), progress: { opened: [1, 2] } });
  await expect(page.getByText('Nach dem Advent')).toBeVisible();
  await expect(door(page, 1)).toHaveAttribute('data-state', 'opened');
  await expect(door(page, 24)).toHaveAttribute('data-state', 'missed');
  await door(page, 1).click();
  await expect(page.getByRole('dialog', { name: titleOf(1) })).toBeVisible();
});

test('the same calendar does not restart in another year', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR + 1, 12, 5, 10), progress: { opened: [1] } });
  await expect(door(page, 1)).toHaveAttribute('data-state', 'opened');
  await expect(door(page, 5)).toHaveAttribute('data-state', 'missed');
  await expect(page.locator('button.house[data-state="available"]')).toHaveCount(0);
});

test('crossing Zurich midnight makes the next door available without a reload', async ({ page }) => {
  // 23:59 on 5 December in Zurich; door 5 is today's door.
  await visit(page, { at: zurichInstant(YEAR, 12, 5, 23, 59) });
  await expect(door(page, 5)).toHaveAttribute('data-state', 'available');
  await expect(door(page, 6)).toHaveAttribute('data-state', 'locked');
  // Move past midnight; the countdown reaching zero re-derives the states.
  await page.clock.fastForward('02:10');
  await expect(door(page, 6)).toHaveAttribute('data-state', 'available');
  await expect(door(page, 5)).toHaveAttribute('data-state', 'missed');
});

test('opened doors appear in another tab (convenience synchronisation)', async ({ context, page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  const second = await context.newPage();
  await second.clock.install({ time: zurichInstant(YEAR, 12, 5) });
  await second.goto('/');
  await expect(door(second, 5)).toHaveAttribute('data-state', 'available');

  await door(page, 5).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // The storage event reaches the other tab.
  await expect(door(second, 5)).toHaveAttribute('data-state', 'opened');
  await second.close();
});

test('works when localStorage is unavailable, and says so', async ({ page }) => {
  await page.clock.install({ time: zurichInstant(YEAR, 12, 5) });
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => ({ getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked, key: blocked, length: 0 }),
    });
  });
  await page.goto('/');
  await expect(page.getByText(/Fortschritt kann in diesem Browser gerade nicht gespeichert werden/)).toBeVisible();
  // The calendar still works for this visit.
  await door(page, 5).click();
  await expect(page.getByRole('dialog', { name: titleOf(5) })).toBeVisible();
});

test('reduced motion opens without the door animation and without snow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await expect(page.locator('.snowfall')).toHaveCount(0);
  await door(page, 5).click();
  await expect(page.getByRole('dialog', { name: titleOf(5) })).toBeVisible({ timeout: 1500 });
});

test('audio is never set to autoplay', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 13), progress: { opened: [13] } });
  await door(page, 13).click();
  const audio = page.getByRole('dialog').locator('audio');
  await expect(audio).toHaveCount(1);
  expect(await audio.evaluate((el: HTMLAudioElement) => el.autoplay)).toBe(false);
  expect(await audio.evaluate((el: HTMLAudioElement) => el.preload)).toBe('none');
  expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
});
