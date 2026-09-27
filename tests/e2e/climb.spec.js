import { test, expect, openAt, seed, tap, choose, readDb, settings, ms } from './helpers.js';
import { WEEK } from './seed-data.js';

// Jebel Uhud: the fast climber (a step per successful day) and the fullness
// climber (a step per day left wanting), 30 steps to the summit.

const stepsOf = (page, kind) => page.getByTestId(`climb-${kind}`).locator('.stat-value');

test('two climbers: a step per successful day, and per day left wanting', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00');
  await seed(page, WEEK);
  // Successes on the 20th, 22nd, 25th and 26th; every meal left wanting on the 20th and 24th.
  await expect(stepsOf(page, 'fast')).toHaveText('4 of 30');
  await expect(stepsOf(page, 'fullness')).toHaveText('2 of 30');
  await expect(page.getByTestId('summits')).toHaveText('Fasts: 0 summits · Fullness: 0 summits');
  await expect(page.locator('[data-block="streak"]')).toHaveCount(0);
  // Today's window has no meals: the day's end asks how it finished.
  const card = page.locator('[data-block="fullness"]');
  await expect(card).toContainText('How did you finish eating today?');
  await choose(page, 'day-fullness', 'before_full');
  await expect(stepsOf(page, 'fullness')).toHaveText('3 of 30');
  expect((await readDb(page)).days.find((d) => d.day === '2026-09-26').fullness).toBe('before_full');
});

test('with every meal rated, the day reads from the meals; one satisfied meal holds the climber', async ({ page }) => {
  await openAt(page, '2026-09-24T23:00');
  await seed(page, WEEK);
  await expect(page.locator('[data-block="fullness"]').getByTestId('day-fullness')).toHaveText('Left wanting at every meal.');
  await expect(stepsOf(page, 'fullness')).toHaveText('2 of 30');
  await page.goto('./#day/2026-09-22');
  await expect(page.locator('[data-block="fullness"]').getByTestId('day-fullness')).toHaveText('Satisfied at one meal or more.');
});

test('thirty successful days: a climber on the summit, and a new one from the base', async ({ page }) => {
  const days = [];
  for (let i = 0; i < 32; i++) {
    const key = new Date(Date.UTC(2026, 7, 26 + i)).toISOString().slice(0, 10);
    days.push({ day: key, firstBite: ms(`${key}T17:00`), lastBite: ms(`${key}T20:00`) });
  }
  await openAt(page, '2026-09-26T23:00');
  await seed(page, { days, settings: settings({ installedAt: ms('2026-08-26T08:00') }) });
  await expect(stepsOf(page, 'fast')).toHaveText('2 of 30');
  await expect(page.getByTestId('summits')).toContainText('Fasts: 1 summit');
  await expect(page.locator('[data-testid="uhud"] .summiteer[data-climber="fast"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="uhud"] .climber[data-climber="fast"]')).toHaveCount(1);
});

test('a climber switched off is hidden and does not track; switched on, it resumes', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#more');
  await seed(page, WEEK);
  await choose(page, 'climb-fullness', 'false');
  await page.locator('.tab[data-tab="today"]').click();
  await expect(page.getByTestId('climb-fullness')).toHaveCount(0);
  await expect(page.getByTestId('summits')).toHaveText('Fasts: 0 summits');
  // Off from the 20th to the 22nd: the left-wanting 20th does not count.
  await seed(page, { ...WEEK, settings: [...WEEK.settings, { key: 'climb', value: { fast: { on: true, off: [] }, fullness: { on: true, off: [{ from: '2026-09-20', to: '2026-09-22' }] } } }] });
  await expect(stepsOf(page, 'fullness')).toHaveText('1 of 30');
  // Both off: the streak comes back in their place.
  await seed(page, { ...WEEK, settings: [...WEEK.settings, { key: 'climb', value: { fast: { on: false, off: [] }, fullness: { on: false, off: [] } } }] });
  await expect(page.locator('[data-block="climb"]')).toHaveCount(0);
  await expect(page.getByTestId('streak')).toBeVisible();
});

test('a paused day holds the fast climber and still counts fullness', async ({ page }) => {
  await openAt(page, '2026-09-27T20:00');
  await seed(page, WEEK);
  await tap(page, 'pause-today');
  const card = page.locator('[data-block="fullness"]');
  await expect(card).toContainText('How did you finish eating today?');
  await choose(page, 'day-fullness', 'before_full');
  await expect(stepsOf(page, 'fullness')).toHaveText('3 of 30');
  await expect(stepsOf(page, 'fast')).toHaveText('4 of 30');
});
