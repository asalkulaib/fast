import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as w from '../../docs/js/core/weight.js';

const TODAY = '2026-09-25';
const LIST = '2026-09-19:104.6,2026-09-20:104.3,2026-09-21:104.1';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

test('unwraps every supported payload shape to the same list', () => {
  const shapes = [
    `w=${LIST}`,
    `#w=${LIST}`,
    `https://someone.github.io/fast/import#w=${LIST}`,
    `https://someone.github.io/fast/import/#w=${encodeURIComponent(LIST)}`,
    b64(`w=${LIST}`),
    `b=${b64(`w=${LIST}`)}`,
    `#b=${b64(`w=${LIST}`)}`,
    LIST,
    `  ${b64(`w=${LIST}`)}\n`,
  ];
  for (const s of shapes) assert.equal(w.unwrapPayload(s), LIST, s);
});

test('returns null for text that is not weight data', () => {
  for (const s of ['', 'hello there', 'https://example.com', b64('just some text'), '#w=', 'w=nothing']) {
    const parsed = w.parseImport(s, TODAY);
    assert.equal(parsed, null, s);
  }
});

test('parses entries; the last value for a duplicate date wins', () => {
  const r = w.parseImport('w=2026-09-20:104.6,2026-09-21:104.3,2026-09-21:104.1,2026-09-22:103.9', TODAY);
  assert.equal(r.found, 4);
  assert.equal(r.skipped, 0);
  assert.equal(r.entries.size, 3);
  assert.equal(r.entries.get('2026-09-21'), 104.1);
});

test('handles comma decimals, whole numbers, units and Arabic digits', () => {
  const r = w.parseImport('w=2026-09-20:104,6,2026-09-21:104,2026-09-22:103.95 kg,2026-09-23: 103,5', TODAY);
  assert.deepEqual([...r.entries.entries()], [
    ['2026-09-20', 104.6], ['2026-09-21', 104], ['2026-09-22', 103.95], ['2026-09-23', 103.5],
  ]);
  const arabic = w.parseImport('w=٢٠٢٦-٠٩-٢٤:١٠٤٫٦', TODAY);
  assert.equal(arabic.entries.get('2026-09-24'), 104.6);
  const many = w.parseImport('w=2026-09-24:104.59999999999', TODAY);
  assert.equal(many.entries.get('2026-09-24'), 104.6);
});

test('skips impossible dates, future dates and values outside the plausible kg range', () => {
  const r = w.parseImport('w=2026-02-30:104,2026-09-26:104,2026-09-20:12,2026-09-21:231.5,2026-09-22:104.2', TODAY);
  assert.equal(r.found, 5);
  assert.equal(r.skipped, 4);
  assert.deepEqual([...r.entries.keys()], ['2026-09-22']);
});

test('values marked in pounds are converted to kg', () => {
  const r = w.parseImport('w=2026-09-22:231.5 lb,2026-09-23:230.8lbs', TODAY);
  assert.equal(r.entries.get('2026-09-22'), 105.01);
  assert.equal(r.entries.get('2026-09-23'), 104.69);
});

test('a batch about 2.2 times the stored level looks like pounds', () => {
  const stored = new Map([['2026-09-10', 80.2], ['2026-09-11', 80.0], ['2026-09-12', 79.8]]);
  assert.equal(w.looksLikePounds(stored, new Map([['2026-09-20', 176.1], ['2026-09-21', 175.8]])), true);
  assert.equal(w.looksLikePounds(stored, new Map([['2026-09-20', 79.9]])), false);
  assert.equal(w.looksLikePounds(new Map(), new Map([['2026-09-20', 176.1]])), false);
});

test('diff counts new, changed and unchanged dates', () => {
  const existing = new Map([['2026-09-20', 104.6], ['2026-09-21', 104.3]]);
  const incoming = new Map([['2026-09-20', 104.6], ['2026-09-21', 104.2], ['2026-09-22', 103.9]]);
  assert.deepEqual(w.diffEntries(existing, incoming), { added: 1, updated: 1, unchanged: 1 });
});

test('averages respect the three weigh-in floor', () => {
  const weights = new Map([['2026-09-20', 100], ['2026-09-21', 101]]);
  assert.deepEqual(w.averageBetween(weights, '2026-09-19', '2026-09-25'), { avg: null, n: 2 });
  weights.set('2026-09-22', 102);
  assert.deepEqual(w.averageBetween(weights, '2026-09-19', '2026-09-25'), { avg: 101, n: 3 });
});

test('rolling 7-day average ends on the latest weigh-in and compares with the 7 days before', () => {
  const weights = new Map();
  for (let d = 5; d <= 18; d++) weights.set(`2026-09-${String(d).padStart(2, '0')}`, 110 - d * 0.1);
  const s = w.rollingSummary(weights);
  assert.equal(s.end, '2026-09-18');
  assert.equal(s.current.n, 7);
  assert.equal(s.previous.n, 7);
  assert.ok(Math.abs(s.current.avg - (110 - 1.5)) < 1e-9);
  assert.ok(Math.abs(s.change - -0.7) < 1e-9);
});

test('weekly averages group Sunday to Saturday', () => {
  const weights = new Map([
    ['2026-09-19', 105], // Saturday, week of 13 Sep (only one entry: hidden)
    ['2026-09-20', 104], ['2026-09-22', 103], ['2026-09-26', 102], // week of 20 Sep
    ['2026-09-27', 101], ['2026-09-28', 101], ['2026-09-29', 101], // week of 27 Sep
  ]);
  assert.deepEqual(w.weeklyAverages(weights), [
    { week: '2026-09-20', avg: 103, n: 3 },
    { week: '2026-09-27', avg: 101, n: 3 },
  ]);
  const s = w.weekSummary(weights, '2026-09-27');
  assert.equal(s.current.avg, 101);
  assert.equal(s.previous.avg, 103);
  assert.equal(s.change, -2);
});
