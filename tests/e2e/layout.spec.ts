/**
 * Layout checks across the phone sizes this calendar is actually read on,
 * plus landscape and desktop. These run in a desktop browser with the
 * viewport resized — browser emulation, not real devices.
 */
import { expect, test, type Page } from '@playwright/test';
import { door, visit, YEAR, zurichInstant } from './helpers.ts';

const SIZES = [
  { name: '320x568 (kleines Handy)', width: 320, height: 568 },
  { name: '375x667 (iPhone SE)', width: 375, height: 667 },
  { name: '390x844 (iPhone 14)', width: 390, height: 844 },
  { name: '430x932 (iPhone Pro Max)', width: 430, height: 932 },
  { name: '844x390 (Querformat)', width: 844, height: 390 },
  { name: '1280x800 (Desktop)', width: 1280, height: 800 },
];

/** No part of the page may scroll sideways. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(overflow.scrollWidth, 'document must not scroll horizontally').toBeLessThanOrEqual(overflow.clientWidth + 1);
}

for (const size of SIZES) {
  test(`calendar and game fit at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await visit(page, { at: zurichInstant(YEAR, 12, 6), progress: { opened: [1, 2, 3, 4, 5] } });

    await expect(page.locator('button.house')).toHaveCount(24);
    await expectNoHorizontalOverflow(page);

    // The decorative moon never sits on top of the title.
    const moonBox = (await page.locator('.moon').boundingBox())!;
    const titleBox = (await page.locator('h1').boundingBox())!;
    const overlaps =
      moonBox.x < titleBox.x + titleBox.width &&
      titleBox.x < moonBox.x + moonBox.width &&
      moonBox.y < titleBox.y + titleBox.height &&
      titleBox.y < moonBox.y + moonBox.height;
    expect(overlaps, 'moon must not cover the title').toBe(false);

    // Every door is a comfortable tap target.
    const smallest = await page.locator('button.house').evaluateAll((nodes) =>
      Math.min(...nodes.map((node) => Math.min(node.getBoundingClientRect().width, node.getBoundingClientRect().height))),
    );
    expect(smallest).toBeGreaterThanOrEqual(40);

    // The surprise dialog fits and scrolls vertically only.
    await door(page, 1).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const dialogOverflow = await page.locator('.surprise-scroll').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(dialogOverflow).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');

    // The game: playfield and controls both visible, controls not covering it.
    await door(page, 6).click();
    await page.getByRole('button', { name: 'Mission starten' }).click();
    await page.getByRole('button', { name: 'Los geht es' }).click();
    const canvas = page.getByRole('img', { name: 'Der Samichlaus im Winterwald' });
    await expect(canvas).toBeVisible();

    const canvasBox = (await canvas.boundingBox())!;
    const jumpBox = (await page.getByRole('button', { name: 'Springen' }).boundingBox())!;
    const leftBox = (await page.getByRole('button', { name: 'Nach links' }).boundingBox())!;
    const pauseBox = (await page.getByRole('button', { name: 'Spiel pausieren' }).boundingBox())!;

    // Controls sit below the playfield, not on top of it.
    expect(jumpBox.y).toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height - 1);
    expect(leftBox.y).toBeGreaterThanOrEqual(canvasBox.y + canvasBox.height - 1);
    // Movement on the left, jump on the right, pause far from both.
    expect(leftBox.x).toBeLessThan(jumpBox.x);
    expect(pauseBox.y + pauseBox.height).toBeLessThanOrEqual(canvasBox.y + 1);
    // Everything stays inside the viewport.
    for (const box of [canvasBox, jumpBox, leftBox]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
    }
    // Touch targets: at least 44 px, and 56 px or more where there is room.
    expect(Math.min(jumpBox.width, jumpBox.height)).toBeGreaterThanOrEqual(44);
    expect(Math.min(leftBox.width, leftBox.height)).toBeGreaterThanOrEqual(44);
    if (size.height >= 568) {
      expect(Math.min(leftBox.width, leftBox.height)).toBeGreaterThanOrEqual(56);
      expect(Math.min(jumpBox.width, jumpBox.height)).toBeGreaterThanOrEqual(56);
    }
    // A useful amount of the level is visible.
    expect(canvasBox.height).toBeGreaterThan(120);
  });
}

test('an orientation change keeps the game playable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await visit(page, { at: zurichInstant(YEAR, 12, 6), progress: { opened: [6] } });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  await page.getByRole('button', { name: 'Los geht es' }).click();
  const canvas = page.getByRole('img', { name: 'Der Samichlaus im Winterwald' });
  await expect(canvas).toBeVisible();

  const progressWidth = () => page.locator('.game-progress > span').evaluate((el) => el.getBoundingClientRect().width);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  const before = await progressWidth();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(canvas).toBeVisible();
  // Rotating must not move the player or break the controls.
  expect(await progressWidth()).toBeCloseTo(before, 0);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  await expect.poll(progressWidth).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: 'Springen' })).toBeVisible();
});
