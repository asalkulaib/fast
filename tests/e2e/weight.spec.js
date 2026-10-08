import { test, expect, openAt, tap, choose, readDb, seed, settings, ms } from './helpers.js';

// 14 days up to Sunday 27 Sep. 21 Sep appears twice: the later value wins.
const DAYS = [
  ['2026-09-14', 105.8], ['2026-09-15', 105.9], ['2026-09-16', 105.4], ['2026-09-17', 105.6],
  ['2026-09-18', 105.1], ['2026-09-19', 105.3], ['2026-09-20', 104.9], ['2026-09-21', 104.6],
  ['2026-09-21', 104.7], ['2026-09-22', 104.8], ['2026-09-23', 104.3], ['2026-09-24', 104.6],
  ['2026-09-25', 104.2], ['2026-09-26', 104.1], ['2026-09-27', 103.9],
];
const PAYLOAD = `w=${DAYS.map(([d, kg]) => `${d}:${kg}`).join(',')}`;
const RAW = [...new Set(DAYS.map(([, kg]) => kg.toFixed(1)))];
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

/** Import messages give counts only, never a weight. */
async function expectNoRawValues(page) {
  const text = await bodyText(page);
  for (const v of RAW) expect(text, `daily value ${v} must never be shown`).not.toContain(v);
  expect(text).not.toMatch(/\d{2,3},\d/); // no comma-decimal forms either
}

test('import link: hash cleared, duplicates resolved, counts only', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T09:00:00+03:00') });
  await page.goto(`./import/#${PAYLOAD}`);
  await expect(page.getByTestId('import-result')).toHaveText('Imported 14 entries.');
  expect(new URL(page.url()).hash).toBe('');
  await expectNoRawValues(page);

  const db = await readDb(page);
  expect(db.weights).toHaveLength(14);
  expect(db.weights.find((w) => w.date === '2026-09-21').kg).toBe(104.7);

  // The Weight screen shows only averages: the 7-day average, its change, and the 7-day average over time,
  // whose latest point is the same figure as at the top.
  await page.getByRole('link', { name: 'Open Fast' }).click();
  await expect(page.getByTestId('weight-average')).toHaveText('104.4 kg');
  await expect(page.getByTestId('weight-change')).toHaveText('Change from the 7 days before: −1.1 kg.');
  await expect(page.locator('.chart .latest')).toHaveCount(1);
  await expect(page.locator('.chart .chart-end')).toHaveText('104.4');

  // Re-importing overlapping days: unchanged days are counted as already saved.
  await page.goto('./import/#w=2026-09-20:104.9,2026-09-21:104.7,2026-09-22:104.8,2026-09-23:104.3,2026-09-24:104.6,2026-09-25:104.2,2026-09-26:104.1,2026-09-27:103.8');
  await expect(page.getByTestId('import-result')).toHaveText('Imported 1 entry. 7 already saved.');
  const db2 = await readDb(page);
  expect(db2.weights.find((w) => w.date === '2026-09-27').kg).toBe(103.8);
});

test('the import link works without a trailing slash (the redirect keeps the data)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T09:00:00+03:00') });
  await page.goto('./import#w=2026-09-25:104.2,2026-09-26:104.1,2026-09-27:103.9');
  await expect(page.getByTestId('import-result')).toHaveText('Imported 3 entries.');
  expect(new URL(page.url()).pathname).toBe('/fast/import/');
  expect(new URL(page.url()).hash).toBe('');
});

test('the main address also accepts a Base64 link and clears it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T09:00:00+03:00') });
  await page.goto(`./#b=${b64(PAYLOAD)}`);
  await expect(page.getByTestId('flash')).toHaveText('Imported 14 entries.');
  expect(new URL(page.url()).hash).toBe('#weight');
  await expectNoRawValues(page);
});

test('Import weight reads the clipboard (scrambled payload from the Shortcut)', async ({ page }) => {
  await page.addInitScript((text) => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: async () => text, writeText: async () => {} }, configurable: true });
  }, b64(PAYLOAD));
  await openAt(page, '2026-09-27T09:00', '#weight');
  await expect(page.getByText('No weigh-ins yet')).toBeVisible();
  await tap(page, 'import-weight');
  await expect(page.getByTestId('flash')).toHaveText('Imported 14 entries.');
  await expect(page.getByTestId('weight-average')).toHaveText('104.4 kg');
  await expect(page.getByTestId('paste-target')).toHaveCount(0);
  await expectNoRawValues(page);
});

test('when the clipboard holds no weight data, a paste box takes a paste without showing it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: async () => 'hello', writeText: async () => {} }, configurable: true });
  });
  await openAt(page, '2026-09-27T09:00', '#weight');
  await tap(page, 'import-weight');
  await expect(page.getByTestId('flash')).toContainText('No weight data found. Run the Fast Weight shortcut');
  const target = page.getByTestId('paste-target');
  await expect(target).toBeVisible();

  // Typing is refused: weight can never be typed in.
  await target.focus();
  await page.keyboard.type('w=2026-09-25:104');
  await expect(target).toHaveValue('');
  expect((await readDb(page)).weights).toHaveLength(0);

  // A paste is imported and never rendered.
  await target.evaluate((el, text) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PAYLOAD);
  await expect(page.getByTestId('flash')).toHaveText('Imported 14 entries.');
  expect((await readDb(page)).weights).toHaveLength(14);
  await expectNoRawValues(page);
});

test('every weigh-in counts: one weigh-in is its own average, two are averaged', async ({ page }) => {
  await openAt(page, '2026-09-27T09:00', '#weight');
  await seed(page, {
    weights: [{ date: '2026-09-26', kg: 104.1 }],
    settings: settings({ installedAt: ms('2026-09-20T08:00'), lastImportAt: ms('2026-09-27T08:00') }),
  });
  await expect(page.getByTestId('weight-average')).toHaveText('104.1 kg');
  await expect(page.locator('.chart .chart-end')).toHaveText('104.1');
  await seed(page, {
    weights: [{ date: '2026-09-26', kg: 104.1 }, { date: '2026-09-27', kg: 103.9 }],
    settings: settings({ installedAt: ms('2026-09-20T08:00'), lastImportAt: ms('2026-09-27T08:00') }),
  });
  await expect(page.getByTestId('weight-average')).toHaveText('104.0 kg');
  await expect(page.locator('[data-block="chart"] svg.chart rect')).toHaveCount(2);
});

test('bad entries are skipped and reported by count only', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T09:00:00+03:00') });
  await page.goto('./import/#w=2026-09-26:229.5,2026-02-30:104,2026-09-28:104.1');
  await expect(page.getByTestId('import-result')).toContainText('Nothing imported. 3 entries skipped');
  expect((await readDb(page)).weights).toHaveLength(0);
});

test('the chart follows the 7-day average on each day with one, in the time frame chosen, with a note', async ({ page }) => {
  await openAt(page, '2026-10-08T09:00', '#weight');
  const weights = [
    ['2026-03-02', 100], ['2026-03-03', 101], ['2026-03-04', 102],
    ['2026-08-20', 104], ['2026-08-22', 103], ['2026-08-26', 102], ['2026-08-27', 101],
    ['2026-10-05', 100], ['2026-10-06', 99], ['2026-10-07', 98],
  ].map(([date, kg]) => ({ date, kg }));
  await seed(page, { weights, settings: settings({ installedAt: ms('2026-03-01T08:00'), lastImportAt: ms('2026-10-08T08:00') }) });
  const chart = page.locator('[data-block="chart"]');
  const marks = chart.locator('svg.chart rect');
  await expect(page.getByTestId('weight-average')).toHaveText('99.0 kg');
  await expect(chart.locator('.chart-end')).toHaveText('99.0');
  await expect(chart.getByTestId('weight-chart-note')).toContainText('Each point is your 7-day average on a day you weighed in');
  // 3 months by default: a point on each of the 7 days with a weigh-in since July. The line runs through
  // August, breaks across September (no weigh-in for over a week), and runs again in October.
  await expect(chart.locator('button[data-choice="weight-range"][aria-checked="true"]')).toHaveText('3 months');
  await expect(marks).toHaveCount(7);
  expect(((await chart.locator('svg.chart path').getAttribute('d')).match(/M/g) || []).length).toBe(2);
  await choose(page, 'weight-range', '1m');
  await expect(marks).toHaveCount(3);
  await choose(page, 'weight-range', 'ytd');
  await expect(marks).toHaveCount(10);
  await tap(page, 'toggle-table');
  const rows = page.getByTestId('weight-table').locator('tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toHaveText('Wed 7 Oct99.0 kg3');
  // The choice is remembered.
  await expect.poll(async () => (await readDb(page)).settings.find((s) => s.key === 'weightRange')?.value).toBe('ytd');
  await page.reload();
  await expect(page.locator('button[data-choice="weight-range"][aria-checked="true"]')).toHaveText('This year');

  // A time frame with no 7-day average says so, and keeps the note.
  await seed(page, { weights: weights.slice(0, 3), settings: settings({ installedAt: ms('2026-03-01T08:00'), weightRange: '1m' }) });
  await expect(chart.getByTestId('weight-chart-empty')).toHaveText('No 7-day average in this time yet.');
  await expect(chart.locator('svg.chart')).toHaveCount(0);
  await expect(chart.getByTestId('weight-chart-note')).toBeVisible();
});
