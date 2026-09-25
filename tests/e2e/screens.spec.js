// Screenshots of every screen and state at 390 x 844 for design review, plus
// a contrast audit of every visible piece of text in each state.
import { test, expect, openAt, seed, advance, tap, pick, choose, sheet, settings, ms } from './helpers.js';
import { WEEK } from './seed-data.js';

test.skip(({ browserName }) => browserName !== 'webkit', 'screens are reviewed in WebKit, the engine of iPhone Safari');

const DIR = 'test-results/screens';

/** Every visible text must reach 4.5:1 (3:1 at 24px and above) on its background. */
async function audit(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = c && c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(',').map((x) => Number(x.trim()));
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const background = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0.5) return c;
        if (e.classList && e.classList.contains('sheet')) break;
      }
      return { r: 5, g: 6, b: 11, a: 1 };
    };
    const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });
    const bad = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      if (!text) continue;
      const el = node.parentElement;
      if (el.closest('[hidden], button[disabled], [aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const bg = background(el);
      const fg = blend(parse(el instanceof SVGElement ? cs.fill : cs.color), bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const size = parseFloat(cs.fontSize);
      const need = size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
      if (ratio + 0.01 < need) bad.push(`${text.slice(0, 40)} (${ratio.toFixed(2)} at ${size}px)`);
    }
    return bad;
  });
}

async function shot(page, name, { full = false } = {}) {
  await page.waitForTimeout(450); // let fades settle
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: full });
  expect(await audit(page), `contrast on ${name}`).toEqual([]);
}

const install = settings({ installedAt: ms('2026-09-20T08:00'), lastBackupAt: ms('2026-09-26T08:00'), lastImportAt: ms('2026-09-26T09:00') });

test('today: before the window', async ({ page }) => {
  await openAt(page, '2026-09-27T13:10');
  await seed(page, { ...WEEK, settings: install });
  await shot(page, '01-today-before-workday');
  await shot(page, '01b-today-before-full', { full: true });
});

test('today: window open, phases and sheets', async ({ page }) => {
  await openAt(page, '2026-09-27T17:30');
  await seed(page, { ...WEEK, settings: install });
  await tap(page, 'first-bite');
  await page.locator('input[data-field="meal-name"]').fill('Dinner');
  await pick(page, 'hunger', 7);
  await shot(page, '02-first-bite-sheet');
  await tap(page, 'start-eating');
  await advance(page, 40);
  await shot(page, '03-today-open');
  await tap(page, 'finish-meal');
  await choose(page, 'stop', 'before_full');
  await pick(page, 'fullness-now', 6);
  await shot(page, '04-finish-meal-sheet');
  await tap(page, 'save-finish');
  await advance(page, 21);
  await expect(sheet(page, 'fullness')).toBeVisible();
  await pick(page, 'fullness-20', 7);
  await shot(page, '05-fullness-check');
  await tap(page, 'save-fullness');
  await advance(page, 155); // 21:06, 24 minutes left
  await shot(page, '06-today-open-warn');
  await advance(page, 30); // grace
  await shot(page, '07-today-open-grace');
  await advance(page, 20); // over
  await shot(page, '08-today-open-over');
  await tap(page, 'done-eating');
  await shot(page, '09-done-eating-sheet');
});

test('today: closed, success and miss', async ({ page }) => {
  await openAt(page, '2026-09-27T21:40');
  await seed(page, {
    ...WEEK,
    days: [...WEEK.days, { day: '2026-09-27', firstBite: ms('2026-09-27T17:34'), lastBite: ms('2026-09-27T21:26'), energy4pm: 4, trained: true, trainingType: 'weights' }],
    meals: [...WEEK.meals, { id: 9, day: '2026-09-27', name: 'Dinner', startedAt: ms('2026-09-27T17:34'), finishedAt: ms('2026-09-27T18:10'), hungerBefore: 7, stop: 'before_full', fullnessNow: 6, fullness20: 7 }],
    settings: install,
  });
  await shot(page, '10-today-closed-success');
  await shot(page, '10b-today-closed-full', { full: true });
  await tap(page, 'ate-something');
  await choose(page, 'trigger', 'boredom');
  await choose(page, 'amount', 'little');
  await shot(page, '11-outside-sheet');
  await tap(page, 'save-outside');
  await shot(page, '12-outside-slip-line');
  await tap(page, 'done');
  await shot(page, '13-today-closed-miss-outside');
});

test('today: over by 20 min and the forgotten close', async ({ page }) => {
  await openAt(page, '2026-09-27T22:00');
  await seed(page, { days: [{ day: '2026-09-27', firstBite: ms('2026-09-27T17:00'), lastBite: ms('2026-09-27T21:20') }], settings: install });
  await shot(page, '14-today-closed-over');
  await seed(page, { days: [{ day: '2026-09-27', firstBite: ms('2026-09-27T15:30'), lastBite: null }], settings: install });
  await shot(page, '15-today-forgot-close');
});

test('today: correcting a window', async ({ page }) => {
  await openAt(page, '2026-09-27T17:45');
  await seed(page, {
    ...WEEK,
    days: [...WEEK.days, { day: '2026-09-27', firstBite: ms('2026-09-27T16:30'), lastBite: null }],
    meals: [...WEEK.meals, { id: 9, day: '2026-09-27', name: 'Dinner', startedAt: ms('2026-09-27T16:30'), finishedAt: null }],
    settings: install,
  });
  await shot(page, '17-today-open-change-link');
  await tap(page, 'change-opening');
  await shot(page, '18-opening-sheet');
  await tap(page, 'remove-window');
  await shot(page, '18b-opening-remove-confirm');
  await tap(page, 'keep-window');
  await tap(page, 'close-sheet');
  await seed(page, { ...WEEK, days: [...WEEK.days, { day: '2026-09-27', firstBite: ms('2026-09-27T12:30'), lastBite: ms('2026-09-27T16:50') }], settings: install });
  await tap(page, 'change-times');
  await shot(page, '19-window-times-sheet');
});

test('today: notices', async ({ page }) => {
  await openAt(page, '2026-09-27T09:00');
  await seed(page, { days: [WEEK.days[0]], settings: settings({ installedAt: ms('2026-09-18T08:00') }) });
  await shot(page, '16-today-notices');
});

test('temptation flow', async ({ page }) => {
  await openAt(page, '2026-09-27T13:10');
  await seed(page, { ...WEEK, settings: install });
  await tap(page, 'tempted');
  await shot(page, '20-tempted-trigger');
  await choose(page, 'trigger', 'boredom');
  await shot(page, '21-tempted-gains');
  await tap(page, 'ride-it-out');
  await shot(page, '22-tempted-surf');
  await pick(page, 'urge', 7);
  await advance(page, 4);
  await shot(page, '23-tempted-surf-4min', { full: true });
  await tap(page, 'stop-timer');
  await shot(page, '24-tempted-how-now');
  await tap(page, 'with-people');
  await shot(page, '25-tempted-social', { full: true });
  await tap(page, 'cant-avoid');
  await shot(page, '26-tempted-cant-before');
  await tap(page, 'back');
  await tap(page, 'ride-it-out');
  await advance(page, 11);
  await tap(page, 'held');
  await shot(page, '27-tempted-held');
});

test('temptation flow after the window', async ({ page }) => {
  await openAt(page, '2026-09-27T21:40');
  await seed(page, { ...WEEK, days: [...WEEK.days, { day: '2026-09-27', firstBite: ms('2026-09-27T17:30'), lastBite: ms('2026-09-27T20:30') }], settings: install });
  await tap(page, 'tempted');
  await choose(page, 'trigger', 'tired');
  await tap(page, 'cant-avoid');
  await shot(page, '28-tempted-cant-after');
});

test('week, day, weight, more, help', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#week');
  await seed(page, WEEK);
  await shot(page, '30-week');
  await shot(page, '30b-week-full', { full: true });
  await page.locator('.dayrow[data-day="2026-09-24"]').click();
  await shot(page, '31-day-editor', { full: true });
  await page.locator('.tab[data-tab="weight"]').click();
  await page.evaluate(async () => {
    const db = await import('/fast/js/db.js');
    const w = [];
    let kg = 106.2;
    for (let d = new Date('2026-07-05T12:00:00Z'); d <= new Date('2026-09-26T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      kg -= 0.03 + (d.getUTCDate() % 3) * 0.01;
      w.push({ date: d.toISOString().slice(0, 10), kg: Math.round(kg * 10) / 10 });
    }
    await db.replaceAll({ ...(await db.readAll()), weights: w });
  });
  await page.reload();
  await shot(page, '32-weight');
  await page.locator('.chart').click({ position: { x: 120, y: 80 } });
  await tap(page, 'toggle-table');
  await shot(page, '33-weight-table', { full: true });
  await page.locator('.tab[data-tab="more"]').click();
  await shot(page, '34-more');
  await shot(page, '34b-more-full', { full: true });
  await tap(page, 'help');
  await shot(page, '35-help', { full: true });
});

test('weight: empty, import page', async ({ page }) => {
  await openAt(page, '2026-09-27T09:00', '#weight');
  await shot(page, '36-weight-empty');
  await page.goto('./import/#w=2026-09-20:104.6,2026-09-21:104.3,2026-09-22:104.1');
  await expect(page.getByTestId('import-result')).toBeVisible();
  await shot(page, '37-import-page');
});
