import { test, expect, openAt, seed, readDb, tap, setTime, captureShares, sharedFiles, sheet } from './helpers.js';
import { WEEK } from './seed-data.js';

const stripSettings = (db) => ({ ...db, settings: undefined });

test('CSV export: five files for Excel', async ({ page }) => {
  await captureShares(page);
  await openAt(page, '2026-09-26T23:00', '#more');
  await seed(page, WEEK);
  await tap(page, 'export-csv');
  await expect(page.getByTestId('flash')).toHaveText('CSV files handed to iOS.');
  const files = await sharedFiles(page);
  expect(files.map((f) => f.name)).toEqual(['fast-windows.csv', 'fast-meals.csv', 'fast-weight.csv', 'fast-checkins.csv', 'fast-temptations.csv']);
  for (const f of files) {
    expect(f.type).toBe('text/csv');
    expect(f.head).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte order mark, so Excel reads it correctly
    expect(f.text).toContain('\r\n');
  }
  const windows = files[0].text.trim().split('\r\n');
  expect(windows).toHaveLength(8);
  expect(windows[2]).toBe('2026-09-21,Monday,workday,15:00,18:00,2026-09-21,180,miss,opened before 16:00,,yes,0');
  const weight = files[2].text.trim().split('\r\n');
  expect(weight).toEqual(['date,kg', '2026-09-14,106', '2026-09-16,105.5', '2026-09-18,105', '2026-09-21,104.9', '2026-09-23,104.7', '2026-09-25,104.5']);
  expect(files[1].text).toContain('2026-09-24,outside the window,,22:00,,,,,,boredom,little');
});

test('JSON backup, wipe, restore: everything comes back', async ({ page }) => {
  await captureShares(page);
  await openAt(page, '2026-09-27T10:00'); // 7 days after install: a backup is due
  await seed(page, WEEK);
  await expect(page.locator('[data-notice="backup"]')).toContainText('No backup yet.');
  const before = await readDb(page);

  await page.locator('[data-action="backup-now"]').click();
  await expect(page.getByTestId('flash')).toContainText('Backup handed to iOS.');
  await expect(page.locator('[data-notice="backup"]')).toHaveCount(0);
  const [file] = await sharedFiles(page);
  expect(file.name).toBe('fast-backup-2026-09-27.json');
  const backup = JSON.parse(file.text);
  expect(backup).toMatchObject({ app: 'fast', schema: 1 });
  expect(backup.data.days).toHaveLength(7);
  expect(backup.data.weights).toHaveLength(6);

  // Wipe everything.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('fast');
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  }));
  await page.goto('./#more');
  expect((await readDb(page)).days).toHaveLength(0);

  // Restore from the file.
  await page.getByTestId('restore-input').setInputFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) });
  await expect(sheet(page, 'restore')).toContainText('7 windows, 4 meals, 6 weigh-ins and 4 temptations');
  await tap(page, 'confirm-restore');
  await expect(page.getByTestId('flash')).toHaveText('Backup restored.');
  const after = await readDb(page);
  expect(stripSettings(after)).toEqual(stripSettings(before));
});

test('restore refuses a file that is not a Fast backup', async ({ page }) => {
  await openAt(page, '2026-09-26T23:00', '#more');
  await page.getByTestId('restore-input').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByTestId('flash')).toHaveText('This file is not a Fast backup.');
});

test('calendar file: four weekly alerts, regenerated when times change', async ({ page }) => {
  await captureShares(page);
  await openAt(page, '2026-09-26T23:00', '#more');
  await expect(page.getByTestId('ics-status')).toHaveText('Not added yet.');
  await tap(page, 'add-calendar');
  await expect(page.getByTestId('ics-status')).toHaveText('Added with your current times.');
  let [ics] = await sharedFiles(page);
  expect(ics.name).toBe('fast-reminders.ics');
  expect(ics.type).toBe('text/calendar');
  expect(ics.text.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  expect(ics.text).toContain('DTSTART;TZID=Asia/Kuwait:20260927T130000');
  expect(ics.text).toContain('DTSTART;TZID=Asia/Kuwait:20260927T163000');
  expect(ics.text).toContain('DTSTART;TZID=Asia/Kuwait:20260927T173000');
  expect(ics.text).toContain('DTSTART;TZID=Asia/Kuwait:20260926T140000');

  await setTime(page, 'workdayStart', '18:00');
  await expect(page.getByTestId('ics-status')).toContainText('Your times changed since the last file.');
  await tap(page, 'add-calendar');
  await expect(page.getByTestId('ics-status')).toHaveText('Added with your current times.');
  ics = (await sharedFiles(page))[1];
  expect(ics.text).toContain('DTSTART;TZID=Asia/Kuwait:20260927T180000');
  expect(ics.text).toContain('SEQUENCE:1');
  expect(ics.text).toContain('UID:window-workday@fast.reminders');
});

test('without file sharing, exports download instead', async ({ page }) => {
  await page.addInitScript(() => { delete Navigator.prototype.share; delete Navigator.prototype.canShare; });
  await openAt(page, '2026-09-26T23:00', '#more');
  const download = page.waitForEvent('download');
  await tap(page, 'backup');
  expect((await download).suggestedFilename()).toBe('fast-backup-2026-09-26.json');
});
