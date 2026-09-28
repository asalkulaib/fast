import { test, expect, openAt, seed, advance, tap, choose, sheet, setPick, readDb, settings, ms } from './helpers.js';

// Goals: the eating window (16:8, 18:6, 20:4, 23:1 or 1 to 12 hours); the fast is the rest of the day.

const settingsOf = async (page) => Object.fromEntries((await readDb(page)).settings.map((x) => [x.key, x.value]));

test('a 16:8 goal from More: the window counts down 8 hours, and 7 hours is a success', async ({ page }) => {
  await openAt(page, '2026-09-26T12:00', '#more'); // Saturday: no 16:00 rule
  await expect(page.getByTestId('goal-text')).toHaveText('Eating window 4 hours, fasting 20 hours.');
  await choose(page, 'goal', '8');
  await expect(page.getByTestId('flash')).toHaveText('Goal 16:8 from today.');
  await expect(page.getByTestId('goal-text')).toHaveText('Eating window 8 hours, fasting 16 hours.');
  expect((await settingsOf(page)).goalChanges).toEqual([{ from: '2026-09-26', hours: 8 }]);

  await page.locator('.tab[data-tab="today"]').click();
  await expect(page.locator('[data-action="edit-goal"]')).toContainText('16:8');
  await tap(page, 'start-meal');
  await tap(page, 'start-eating');
  await expect(page.locator('.countdown-caption')).toHaveText('left of 8 hours');
  await expect(page.getByTestId('countdown')).toHaveText('8:00');
  await advance(page, 7 * 60);
  await expect(page.locator('[data-block="open"]')).toHaveAttribute('data-phase', 'window');
  await tap(page, 'done-eating');
  await tap(page, 'close-window');
  await expect(page.locator('[data-block="closed"]')).toHaveAttribute('data-result', 'success');
  await expect(page.getByTestId('window-length')).toHaveText('7 h');
});

test('past days keep the goal they had', async ({ page }) => {
  await openAt(page, '2026-09-27T22:00', '#week');
  await seed(page, {
    days: [
      { day: '2026-09-25', firstBite: ms('2026-09-25T12:00'), lastBite: ms('2026-09-25T19:00') },
      { day: '2026-09-27', firstBite: ms('2026-09-27T16:00'), lastBite: ms('2026-09-27T21:30') },
    ],
    settings: settings({ installedAt: ms('2026-09-25T08:00'), goalChanges: [{ from: '2026-09-27', hours: 6 }] }),
  });
  await page.locator('[data-action="prev-week"]').click();
  await expect(page.locator('.dayrow[data-day="2026-09-25"]')).toContainText('Miss'); // 7 h on the 4-hour goal
  await page.locator('[data-action="next-week"]').click();
  await expect(page.locator('.dayrow[data-day="2026-09-27"]')).toContainText('Success'); // 5 h 30 min on 18:6
  await page.locator('.dayrow[data-day="2026-09-27"]').click();
  await expect(page.locator('.day')).toContainText('Success');
});

test('the Goal note on Today: a custom window from the wheel, and Undo', async ({ page }) => {
  await openAt(page, '2026-09-27T10:00');
  await tap(page, 'edit-goal');
  const s = sheet(page, 'goal');
  await choose(page, 'goal', 'custom');
  await setPick(page, 'goal-hours', 5);
  await expect(page.getByTestId('flash')).toHaveText('Goal 19:5 from today.');
  await expect(s.getByTestId('goal-text')).toHaveText('Eating window 5 hours, fasting 19 hours.');
  await tap(page, 'close-sheet');
  await expect(page.locator('[data-action="edit-goal"]')).toContainText('19:5');
  await tap(page, 'undo');
  await expect(page.locator('[data-action="edit-goal"]')).toContainText('20:4');
  expect((await settingsOf(page)).goalChanges).toEqual([]);
});

test('the ring marks the fasting goal and says how far it is', async ({ page }) => {
  const lastNight = { days: [{ day: '2026-09-26', firstBite: ms('2026-09-26T17:00'), lastBite: ms('2026-09-26T21:00') }] };
  await openAt(page, '2026-09-27T13:10');
  await seed(page, { ...lastNight, settings: settings({ installedAt: ms('2026-09-26T08:00') }) });
  await expect(page.getByTestId('goal-tick')).toHaveAttribute('data-hours', '20');
  await expect(page.getByTestId('goal-line')).toHaveText('Fasting goal 20 h: 3 h 50 min to go.');
  await seed(page, { ...lastNight, settings: settings({ installedAt: ms('2026-09-26T08:00'), goalChanges: [{ from: '2026-09-27', hours: 8 }] }) });
  await expect(page.getByTestId('goal-tick')).toHaveAttribute('data-hours', '16');
  await expect(page.getByTestId('goal-line')).toHaveText('Fasting goal of 16 h reached.');
});
