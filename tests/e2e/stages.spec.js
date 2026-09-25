import { test, expect, openAt, seed, advance, tap, sheet, settings, ms } from './helpers.js';

// Last night's window closed at 21:00 on Saturday 26 September.
const LAST_NIGHT = {
  days: [{ day: '2026-09-26', firstBite: ms('2026-09-26T17:00'), lastBite: ms('2026-09-26T21:00') }],
  settings: settings({ installedAt: ms('2026-09-26T08:00') }),
};

test('before the window: the stage bar shows where the fast stands', async ({ page }) => {
  await openAt(page, '2026-09-27T13:10'); // 16 h 10 min after the last bite
  await seed(page, LAST_NIGHT);
  const stages = page.locator('[data-block="stages"]');
  await expect(stages).toHaveAttribute('data-stage', 'switch');
  await expect(page.getByTestId('fasting-for')).toHaveText('16 h 10 min');
  await expect(page.getByTestId('stage-name')).toHaveText('Metabolic switch');
  await expect(stages).toContainText('fat becomes the main fuel and ketones start to rise');
  await expect(page.getByTestId('stage-next')).toHaveText('Next: ketones climbing, in about 7 h 50 min.');
  // The marker sits two thirds along the 24-hour scale.
  const x = Number(await page.getByTestId('stage-marker').getAttribute('x'));
  expect(x).toBeGreaterThan(225);
  expect(x).toBeLessThan(231);
  // The time no longer repeats in the margin.
  await expect(page.locator('[data-block="before"] .note')).not.toContainText('Since');
});

test('a new stage arrives while the app is open', async ({ page }) => {
  await openAt(page, '2026-09-27T08:55'); // 11 h 55 min
  await seed(page, LAST_NIGHT);
  await expect(page.getByTestId('stage-name')).toHaveText('Blood sugar settles');
  await expect(page.getByTestId('stage-next')).toHaveText('Next: metabolic switch, in about 5 min.');
  await advance(page, 6);
  await expect(page.getByTestId('stage-name')).toHaveText('Metabolic switch');
  await expect(page.locator('[data-block="stages"]')).toHaveClass(/fade-in/);
});

test('hidden while the window is open, back from the last bite once it closes', async ({ page }) => {
  await openAt(page, '2026-09-27T17:30');
  await seed(page, LAST_NIGHT);
  await expect(page.locator('[data-block="stages"]')).toBeVisible();
  await tap(page, 'first-bite');
  await tap(page, 'start-eating');
  await expect(page.locator('[data-block="open"]')).toBeVisible();
  await expect(page.locator('[data-block="stages"]')).toHaveCount(0);
  await advance(page, 60);
  await tap(page, 'done-eating');
  await tap(page, 'close-window');
  await expect(page.getByTestId('stage-name')).toHaveText('Digesting');
  await expect(page.getByTestId('fasting-for')).toHaveText('0 min');
});

test('past 24 hours the bar is full and the last stage shows', async ({ page }) => {
  await openAt(page, '2026-09-27T23:30'); // 26 h 30 min, no window today
  await seed(page, LAST_NIGHT);
  await expect(page.getByTestId('stage-name')).toHaveText('Ketones climbing');
  await expect(page.getByTestId('stage-next')).toHaveCount(0);
  await expect(page.getByTestId('fasting-for')).toHaveText('26 h 30 min');
});

test('about the stages: every stage, the autophagy note and the sources', async ({ page }) => {
  await openAt(page, '2026-09-27T13:10');
  await seed(page, LAST_NIGHT);
  await tap(page, 'about-stages');
  const s = sheet(page, 'stages');
  await expect(s.getByTestId('stage-list').locator('> li')).toHaveCount(4);
  await expect(s).toContainText('from about 12 h');
  await expect(s.getByTestId('autophagy-note')).toContainText('when it starts in people is not known');
  await expect(s).toContainText('Flipping the metabolic switch');
  await expect(s).toContainText('Journal of Clinical Investigation, 1988');
});

test('no bite logged yet: no stage bar', async ({ page }) => {
  await openAt(page, '2026-09-27T13:10');
  await expect(page.locator('[data-block="before"]')).toBeVisible();
  await expect(page.locator('[data-block="stages"]')).toHaveCount(0);
});
