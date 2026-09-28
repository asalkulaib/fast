import { test, expect, openAt, seed, advance, tap, pick, choose, sheet, setTime, readDb, settings, ms } from './helpers.js';

// Meals open the window: the first meal's start is the first bite, and each
// meal keeps its own satiety. One meal at a time.

const install = settings({ installedAt: ms('2026-09-26T08:00') });

test('the first meal opens the window at its start; Undo takes both back', async ({ page }) => {
  await openAt(page, '2026-09-27T18:00');
  await tap(page, 'start-meal');
  const s = sheet(page, 'start-meal');
  await expect(s.getByTestId('meal-context')).toHaveText('Your first meal opens the window.');
  await page.locator('input[data-field="meal-name"]').fill('Dinner');
  await pick(page, 'hunger', 7);
  await tap(page, 'start-eating');
  await expect(page.getByTestId('flash')).toHaveText('Window open from 18:00.');
  await expect(page.locator('[data-block="open"]')).toBeVisible();
  await expect(page.locator('[data-block="eating"]')).toContainText('Dinner, since 18:00.');
  let db = await readDb(page);
  expect(db.days[0].firstBite).toBe(ms('2026-09-27T18:00'));
  expect(db.meals[0]).toMatchObject({ name: 'Dinner', hungerBefore: 7, startedAt: ms('2026-09-27T18:00') });

  await tap(page, 'undo');
  await expect(page.locator('[data-block="before"]')).toBeVisible();
  db = await readDb(page);
  expect(db.days).toEqual([]);
  expect(db.meals).toEqual([]);
});

test('one meal at a time: the next meal first asks how the open one finished', async ({ page }) => {
  await openAt(page, '2026-09-27T18:00');
  await tap(page, 'start-meal');
  await tap(page, 'start-eating');
  await advance(page, 30);
  await tap(page, 'another-meal');
  const finish = sheet(page, 'finish-meal');
  await expect(finish.getByTestId('finish-lead')).toHaveText('One meal at a time. First, how did this one finish?');
  await choose(page, 'stop', 'before_full');
  await pick(page, 'fullness-now', 6);
  await tap(page, 'save-finish');
  await expect(sheet(page, 'start-meal')).toBeVisible();
  await page.locator('input[data-field="meal-name"]').fill('Dessert');
  await tap(page, 'start-eating');
  await expect(page.locator('[data-block="eating"]')).toContainText('Dessert, since 18:30.');
  const meals = (await readDb(page)).meals.sort((a, b) => a.startedAt - b.startedAt);
  expect(meals).toHaveLength(2);
  expect(meals[0]).toMatchObject({ stop: 'before_full', fullnessNow: 6, finishedAt: ms('2026-09-27T18:30') });
  expect(meals[1]).toMatchObject({ name: 'Dessert', finishedAt: null });
});

test('after closing: inside the goal a meal reopens the window', async ({ page }) => {
  await openAt(page, '2026-09-27T20:00');
  await seed(page, { days: [{ day: '2026-09-27', firstBite: ms('2026-09-27T17:00'), lastBite: ms('2026-09-27T19:00') }], settings: install });
  await tap(page, 'start-meal');
  await expect(sheet(page, 'start-meal').getByTestId('meal-context')).toHaveText('This reopens your window from 17:00.');
  await tap(page, 'start-eating');
  await expect(page.getByTestId('flash')).toHaveText('Meal started at 20:00.');
  await expect(page.locator('[data-block="open"]')).toBeVisible();
  expect((await readDb(page)).days[0].lastBite).toBeNull();
});

test('after the goal: a meal counts as eating outside the window, with its satiety', async ({ page }) => {
  await openAt(page, '2026-09-27T22:00');
  await seed(page, { days: [{ day: '2026-09-27', firstBite: ms('2026-09-27T17:00'), lastBite: ms('2026-09-27T20:00') }], settings: install });
  await expect(page.locator('[data-block="closed"]')).toHaveAttribute('data-result', 'success');
  await tap(page, 'start-meal');
  await expect(sheet(page, 'start-meal').getByTestId('meal-context')).toContainText('this meal counts as eating outside it and the day becomes a miss');
  await tap(page, 'start-eating');
  const closed = page.locator('[data-block="closed"]');
  await expect(closed).toHaveAttribute('data-result', 'miss');
  await expect(closed.getByTestId('result')).toHaveText('Ate outside the window.');
  await expect(closed.locator('[data-block="eating"]')).toContainText('Eating, outside the window');
  await tap(page, 'finish-meal');
  await choose(page, 'stop', 'full');
  await tap(page, 'save-finish');
  const [meal] = (await readDb(page)).meals;
  expect(meal).toMatchObject({ outside: true, stop: 'full', startedAt: ms('2026-09-27T22:00') });
  await expect(page.locator('[data-block="meals"]')).toContainText('outside the window');
});

test('a meal already eaten can be logged whole; the window opens at its start', async ({ page }) => {
  await openAt(page, '2026-09-27T19:00');
  await tap(page, 'start-meal');
  await setTime(page, 'meal-start', '18:00');
  await tap(page, 'already-finished');
  await choose(page, 'stop', 'before_full');
  await pick(page, 'fullness-now', 5);
  await setTime(page, 'meal-finish', '18:30');
  await tap(page, 'save-meal');
  await expect(page.getByTestId('flash')).toHaveText('Window open from 18:00.');
  await expect(page.locator('[data-block="open"]')).toBeVisible();
  await expect(page.locator('[data-block="eating"]')).toHaveCount(0);
  const [meal] = (await readDb(page)).meals;
  expect(meal).toMatchObject({ startedAt: ms('2026-09-27T18:00'), finishedAt: ms('2026-09-27T18:30'), stop: 'before_full', fullnessNow: 5 });
});
