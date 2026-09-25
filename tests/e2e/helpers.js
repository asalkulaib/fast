import { test as base, expect } from '@playwright/test';

export { expect };

// The app's own origin (the offline test runs its own server on another local port).
const ORIGIN = 'http://localhost:';

/** Kuwait local time ('2026-09-27T17:30') to a Date. */
export const T = (s) => new Date(`${s}:00+03:00`);
export const ms = (s) => T(s).getTime();
export const MIN = 60_000;

/**
 * Every test also checks that the app never requests anything outside its
 * own origin (no CDN, no analytics).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const outside = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith(ORIGIN) && !url.startsWith('blob:') && !url.startsWith('data:')) outside.push(url);
    });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await use(page);
    expect(outside, 'requests outside the app').toEqual([]);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});

/** Freezes the page clock at a Kuwait time and opens a route. */
export async function openAt(page, when, route = '') {
  await page.clock.install({ time: T(when) });
  await page.goto(`./${route}`);
  await expect(page.locator('#view')).not.toHaveAttribute('aria-busy', 'true');
}

/** Replaces the whole database, then reloads so the app reads it. */
export async function seed(page, data) {
  await page.evaluate(async (d) => {
    const db = await import('/fast/js/db.js');
    await db.replaceAll(d);
  }, {
    days: [], meals: [], outside: [], temptations: [], weights: [], settings: [], ...data,
  });
  await page.reload();
  await expect(page.locator('#view')).not.toHaveAttribute('aria-busy', 'true');
}

export async function readDb(page) {
  return page.evaluate(async () => {
    const db = await import('/fast/js/db.js');
    return db.readAll();
  });
}

/** Moves the clock forward; the app's one-second tick then re-renders. */
export async function advance(page, minutes) {
  await page.clock.fastForward(minutes * MIN);
  await page.clock.fastForward(1000);
}

export const act = (page, name) => page.locator(`[data-action="${name}"]:visible`).first();
export const tap = async (page, name) => act(page, name).click();
export const pick = (page, scale, value) => page.locator(`button[data-scale="${scale}"][data-value="${value}"]:visible`).first().click();
export const choose = (page, name, value) => page.locator(`button[data-choice="${name}"][data-value="${value}"]:visible`).first().click();

export async function setTime(page, name, hhmm) {
  const input = page.locator(`input[data-time="${name}"]:visible`).first();
  await input.fill(hhmm);
  await input.press('Enter');
}

export const sheet = (page, name) => page.locator(`[data-sheet="${name}"]`);

/** Settings row helper for seeding. */
export const settings = (obj) => Object.entries(obj).map(([key, value]) => ({ key, value }));

/**
 * Replaces navigator.share so tests can read the files the app hands to iOS.
 * Shared files land in window.__shared as { name, type, text, head } where
 * head is the first three bytes (text() drops a UTF-8 byte order mark).
 */
export async function captureShares(page) {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => {
      for (const f of files) {
        const head = [...new Uint8Array(await f.slice(0, 3).arrayBuffer())];
        window.__shared.push({ name: f.name, type: f.type, text: await f.text(), head });
      }
    };
  });
}

export async function sharedFiles(page) {
  return page.evaluate(() => window.__shared);
}
