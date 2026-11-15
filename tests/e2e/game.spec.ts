import { expect, test } from '@playwright/test';
import { door, readProgress, titleOf, visit, YEAR, zurichInstant } from './helpers.ts';

const REWARD_TEXT = /Hier steht die Nachricht, die der Samichlaus/;

test('door 6 can only be opened for the first time on 6 December', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 5) });
  await door(page, 6).click();
  await expect(page.getByRole('status').filter({ hasText: `Türchen 6 öffnet sich am 06.12.${YEAR}.` })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('door 6 shows the mission, and the reward is not in the page before victory', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 6) });
  await door(page, 6).click();
  const dialog = page.getByRole('dialog', { name: titleOf(6) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Hilf dem Samichlaus durch den verschneiten Winterwald/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Mission starten' })).toBeVisible();
  // The reward is not rendered anywhere in the document, not even hidden.
  await expect(page.getByText(REWARD_TEXT)).toHaveCount(0);
  expect(await page.content()).not.toMatch(REWARD_TEXT);
});

test('the mission can be continued on a later day without using that day', async ({ page }) => {
  // Door 6 was opened on 6 December; today is the 10th.
  await visit(page, {
    at: zurichInstant(YEAR, 12, 10),
    progress: { opened: [6], game: { started: true, checkpoint: { id: 'cp1', rank: 1 } } },
  });
  await expect(page.getByText('Der Samichlaus ist noch unterwegs. Deine Mission wartet.')).toBeVisible();
  // Today's door is untouched by the game.
  await expect(door(page, 10)).toHaveAttribute('data-state', 'available');

  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.getByRole('dialog', { name: 'Die Mission' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Beim Zwischenstand weiter' })).toBeVisible();
  await page.getByRole('button', { name: 'Zurück zum Kalender' }).click();

  // And today's door still opens normally afterwards.
  await door(page, 10).click();
  await expect(page.getByRole('dialog', { name: titleOf(10) })).toBeVisible();
});

test('the game runs, responds to the keyboard and can be paused', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 6), progress: { opened: [6] } });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  await expect(page.getByRole('dialog', { name: 'Die Mission' })).toBeVisible();
  await page.getByRole('button', { name: 'Los geht es' }).click();

  const canvas = page.getByRole('img', { name: 'Der Samichlaus im Winterwald' });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Springen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nach links' })).toBeVisible();

  const progressWidth = () => page.locator('.game-progress > span').evaluate((el) => el.getBoundingClientRect().width);
  const before = await progressWidth();

  // Hold "right" for a moment: the Samichlaus must actually move.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowRight');
  await expect.poll(progressWidth).toBeGreaterThan(before);

  // Escape pauses, and the pause menu offers the documented choices.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Beim Zwischenstand neu starten' })).toBeVisible();

  // Resuming does not jump the simulation forward.
  const paused = await progressWidth();
  await page.waitForTimeout(600);
  expect(await progressWidth()).toBe(paused);
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeHidden();
});

test('movement and jumping work at the same time through touch controls', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 6), progress: { opened: [6] } });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  await page.getByRole('button', { name: 'Los geht es' }).click();

  const right = page.getByRole('button', { name: 'Nach rechts' });
  const jump = page.getByRole('button', { name: 'Springen' });
  const rightBox = (await right.boundingBox())!;
  const jumpBox = (await jump.boundingBox())!;
  // Touch targets must be comfortable (at least 44 px, aiming for 56–72).
  expect(rightBox.width).toBeGreaterThanOrEqual(44);
  expect(jumpBox.width).toBeGreaterThanOrEqual(44);

  const progressWidth = () => page.locator('.game-progress > span').evaluate((el) => el.getBoundingClientRect().width);
  const before = await progressWidth();

  // Two separate pointers: move right while jumping.
  await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + rightBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await jump.dispatchEvent('pointerdown', { pointerId: 77, isPrimary: false, pointerType: 'touch', bubbles: true });
  await page.waitForTimeout(500);
  await jump.dispatchEvent('pointerup', { pointerId: 77, isPrimary: false, pointerType: 'touch', bubbles: true });
  await page.mouse.up();
  await expect.poll(progressWidth).toBeGreaterThan(before);

  // A cancelled pointer must not leave the direction stuck.
  await right.dispatchEvent('pointerdown', { pointerId: 88, isPrimary: false, pointerType: 'touch', bubbles: true });
  await page.waitForTimeout(200);
  await right.dispatchEvent('pointercancel', { pointerId: 88, isPrimary: false, pointerType: 'touch', bubbles: true });
  await page.waitForTimeout(700);
  const settled = await progressWidth();
  await page.waitForTimeout(700);
  expect(await progressWidth()).toBeCloseTo(settled, 0);
});

test('assist mode can be switched on and is remembered', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 6), progress: { opened: [6] } });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  const assist = page.getByRole('checkbox', { name: /Unterstützung/ });
  await expect(assist).not.toBeChecked();
  await assist.check();
  await expect.poll(async () => (await readProgress(page))?.prefs).toMatchObject({ assist: true });

  await page.reload();
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.getByRole('checkbox', { name: /Unterstützung/ })).toBeChecked();
});

test('sound stays off until it is switched on explicitly', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 6), progress: { opened: [6] } });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  await expect(page.getByRole('checkbox', { name: /Töne/ })).not.toBeChecked();
  expect((await readProgress(page))?.prefs).toMatchObject({ sound: false });
});

test('after victory the reward is readable and survives a reload', async ({ page }) => {
  await visit(page, {
    at: zurichInstant(YEAR, 12, 6),
    progress: { opened: [6], game: { started: true, completed: true } },
  });
  // No "still on the way" banner once the mission is done.
  await expect(page.getByText('Der Samichlaus ist noch unterwegs. Deine Mission wartet.')).toHaveCount(0);

  await door(page, 6).click();
  const dialog = page.getByRole('dialog', { name: titleOf(6) });
  await expect(dialog.getByText(REWARD_TEXT)).toBeVisible();
  await expect(dialog.getByText('Mission erfüllt')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Noch einmal spielen' })).toBeVisible();

  await page.reload();
  await door(page, 6).click();
  await expect(page.getByRole('dialog').getByText(REWARD_TEXT)).toBeVisible();
});

test('replaying does not reset completion', async ({ page }) => {
  await visit(page, {
    at: zurichInstant(YEAR, 12, 6),
    progress: { opened: [6], game: { started: true, completed: true } },
  });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Noch einmal spielen' }).click();
  await expect(page.getByRole('dialog', { name: 'Die Mission' })).toBeVisible();
  await page.getByRole('button', { name: 'Von vorne beginnen' }).click();
  await expect(page.getByRole('img', { name: 'Der Samichlaus im Winterwald' })).toBeVisible();
  expect((await readProgress(page))?.game).toMatchObject({ completed: true });

  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Zurück zum Kalender' }).click();
  await door(page, 6).click();
  await expect(page.getByRole('dialog').getByText(REWARD_TEXT)).toBeVisible();
});

test('a missed day 6 stays missed, and the game is not offered', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 10) });
  await expect(door(page, 6)).toHaveAttribute('data-state', 'missed');
  await door(page, 6).click();
  await expect(page.getByText(`Türchen 6 hatte seinen Tag am 06.12.${YEAR}.`)).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Deine Mission wartet.')).toHaveCount(0);
});

test('the game checkpoint is restored after a reload', async ({ page }) => {
  await visit(page, {
    at: zurichInstant(YEAR, 12, 6),
    progress: { opened: [6], game: { started: true, checkpoint: { id: 'cp2', rank: 2 } } },
  });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await page.getByRole('button', { name: 'Beim Zwischenstand weiter' }).click();
  await expect(page.getByRole('img', { name: 'Der Samichlaus im Winterwald' })).toBeVisible();
  // Starting at checkpoint 2 means the run begins well into the level.
  await expect.poll(() => page.locator('.game-progress > span').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(10);
  await expect(page.getByText('Über die Schlucht')).toBeVisible();
});

test('the game pauses when the page is hidden', async ({ page }) => {
  await visit(page, { at: zurichInstant(YEAR, 12, 6), progress: { opened: [6] } });
  await door(page, 6).click();
  await page.getByRole('button', { name: 'Mission starten' }).click();
  await page.getByRole('button', { name: 'Los geht es' }).click();
  await expect(page.getByRole('img', { name: 'Der Samichlaus im Winterwald' })).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
});
