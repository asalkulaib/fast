import { test, expect, openAt, seed, readDb } from './helpers.js';
import { WEEK } from './seed-data.js';

const pick = (page, name, value) => page.locator(`button[data-choice="${name}"][data-value="${value}"]`).click();

test('history: fasts as bars by default, over 30 days', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#history');
  await seed(page, WEEK);
  await expect(page.locator('.tab[data-tab="history"]')).toHaveAttribute('aria-current', 'page');
  const chart = page.getByTestId('history-chart');
  await expect(chart).toHaveAttribute('data-kind', 'bars');
  // Seven windows logged; the first has no known fast before it.
  await expect(chart.locator('rect[data-day]')).toHaveCount(6);
  await expect(page.getByTestId('history-summary')).toHaveText('Average fast 20 h 35 min, from 6 of the last 30 days.');
  // The latest day is selected and read out.
  await expect(page.getByTestId('history-readout')).toHaveText('Sat 26 Sep: fast 26 h. 7-day trend 20 h 35 min.');
});

test('history: switch to feast, to a line, and to 7 days; the choice is remembered', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#history');
  await seed(page, WEEK);
  await pick(page, 'history-metric', 'feast');
  await expect(page.locator('.history')).toHaveAttribute('data-metric', 'feast');
  await expect(page.getByTestId('history-summary')).toHaveText('Average window 3 h 17 min, from 7 of the last 30 days.');
  await pick(page, 'history-chart', 'line');
  await expect(page.getByTestId('history-chart')).toHaveAttribute('data-kind', 'line');
  // The day-by-day line and the 7-day trend.
  await expect(page.getByTestId('history-chart').locator('path')).toHaveCount(2);
  await expect(page.getByTestId('trend-line')).toHaveCount(1);
  await pick(page, 'history-range', '7');
  await expect(page.getByTestId('history-summary')).toHaveText('Average window 3 h 17 min over the last 7 days.');
  await expect(page.getByTestId('history-chart').locator('text')).toContainText(['Su 20', 'Sa 26']);

  await page.reload();
  await expect(page.getByTestId('history-chart')).toHaveAttribute('data-kind', 'line');
  await expect(page.locator('.history')).toHaveAttribute('data-metric', 'feast');
  const s = Object.fromEntries((await readDb(page)).settings.map((x) => [x.key, x.value]));
  expect(s).toMatchObject({ historyMetric: 'feast', historyChart: 'line', historyRange: 7 });
});

test('history: tap a day to read it, open it, or see the table', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#history');
  await seed(page, WEEK);
  await pick(page, 'history-metric', 'feast');
  await pick(page, 'history-range', '7');
  const bar = page.getByTestId('history-chart').locator('rect[data-day="2026-09-23"]');
  await bar.click();
  await expect(page.getByTestId('history-readout')).toHaveText('Wed 23 Sep: window 4 h 20 min, a miss. 7-day trend 3 h 45 min.');
  await expect(bar).toHaveAttribute('fill', '#F0B25C');
  await page.locator('[data-action="history-toggle-table"]').click();
  const rows = page.getByTestId('history-table').locator('tbody tr');
  await expect(rows).toHaveCount(7);
  await expect(rows.nth(3)).toHaveText(['Wed 23 Sep, miss', '4 h 20 min', '3 h 45 min'].join(''));
  await page.locator('[data-action="history-open-day"]').click();
  await expect(page.locator('.day[data-day="2026-09-23"]')).toBeVisible();
});

test('history: nothing logged yet shows a quiet empty state', async ({ page }) => {
  await openAt(page, '2026-09-27T09:00', '#history');
  await expect(page.getByTestId('history-summary')).toHaveText('Nothing yet in the last 30 days.');
  await expect(page.locator('.history .dunes')).toBeVisible();
});

test('history: misses in clay, the average and the 7-day trend, named in a legend', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#history');
  await seed(page, WEEK);
  await pick(page, 'history-metric', 'feast');
  await pick(page, 'history-range', '7');
  const chart = page.getByTestId('history-chart');
  // Monday opened before 16:00, Wednesday ran over, Thursday had eating outside.
  await expect(chart.locator('rect[data-miss="true"]')).toHaveCount(3);
  await expect(chart.locator('rect[data-day="2026-09-21"]')).toHaveAttribute('fill', '#9E3B23');
  await expect(chart.locator('rect[data-day="2026-09-22"]')).toHaveAttribute('fill', '#9C6832');
  await expect(chart.locator('rect[data-day="2026-09-26"]')).toHaveAttribute('fill', '#F0B25C'); // selected
  await expect(chart.getByTestId('avg-line')).toHaveCount(1);
  await expect(chart.getByTestId('trend-line')).toHaveCount(1);
  await expect(page.getByTestId('history-legend').locator('.legend-item')).toHaveText(['Miss', '7-day trend', 'Average']);
  // On a line, missed days keep their clay markers.
  await pick(page, 'history-chart', 'line');
  await expect(chart.locator('rect[data-miss="true"]')).toHaveCount(3);
});

test('history: paused days are shaded, left out, and read as paused', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#history');
  await seed(page, { ...WEEK, days: WEEK.days.map((d) => (d.day === '2026-09-24' ? { ...d, paused: 'travel' } : d)) });
  await pick(page, 'history-metric', 'feast');
  await pick(page, 'history-range', '7');
  const chart = page.getByTestId('history-chart');
  await expect(chart.locator('rect[data-paused="2026-09-24"]')).toHaveCount(1);
  await expect(chart.locator('rect[data-day="2026-09-24"]')).toHaveCount(0);
  await expect(page.getByTestId('history-summary')).toHaveText('Average window 3 h 30 min, from 6 of the last 7 days.');
  await expect(page.getByTestId('history-legend').locator('.legend-item').last()).toHaveText('Paused');
  await chart.locator('rect[data-paused="2026-09-24"]').click();
  await expect(page.getByTestId('history-readout')).toHaveText('Thu 24 Sep: paused for travel.');
  // The fast that ended on Friday began during the pause, so it is unknown.
  await pick(page, 'history-metric', 'fast');
  await expect(chart.locator('rect[data-day="2026-09-25"]')).toHaveCount(0);
});
