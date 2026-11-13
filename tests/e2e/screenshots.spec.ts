/** Renders key screens at the target widths into screenshots/ for review. */
import { expect, test } from '@playwright/test';
import { demoState, door, login } from './helpers.ts';

const widths = [320, 375, 390, 430, 768, 1280];

for (const width of widths) {
  test(`layout at ${width}px`, async ({ page, request }) => {
    await demoState(request, { at: '2026-12-05T08:00:00Z', openedDays: [1, 2, 4] });
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await login(page);
    await page.waitForTimeout(400);
    // No horizontal scrolling at any width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // Every door is a ≥44×44 px target.
    for (const box of await page.locator('button.house').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `screenshots/home-${width}.png`, fullPage: true });
    await door(page, 4).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/dialog-${width}.png` });
  });
}

test('final door and song card at 390px', async ({ page, request }) => {
  await demoState(request, { at: '2026-12-26T08:00:00Z', openedDays: [3, 6, 14, 24] });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const day of [24, 3, 6, 14]) {
    await door(page, day).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/door-${day}-390.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  }
});
