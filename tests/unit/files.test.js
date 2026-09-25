import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, foldLine, escapeText, icsTimes } from '../../docs/js/core/ics.js';
import { buildCsvFiles, csvCell, toCsv } from '../../docs/js/core/csv.js';
import { buildBackup, parseBackup, describeBackup } from '../../docs/js/core/backup.js';

const T = (s) => Date.parse(`${s}:00+03:00`);
const SETTINGS = { workdayStart: '17:30', weekendStart: '14:00', holdTime: '13:00', trainingTime: '16:30' };

test('ics: four weekly events with alerts in Kuwait time', () => {
  const ics = buildIcs(SETTINGS, { nowTs: T('2026-09-25T10:00'), todayKey: '2026-09-25', sequence: 2 });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 4);
  assert.ok(ics.includes('TZID:Asia/Kuwait'));
  // Friday 25 Sep: workday events start on Sunday 27 Sep; weekend event starts today.
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kuwait:20260927T130000'));
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kuwait:20260927T163000'));
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kuwait:20260927T173000'));
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kuwait:20260925T140000'));
  assert.equal((ics.match(/RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH/g) || []).length, 3);
  assert.equal((ics.match(/RRULE:FREQ=WEEKLY;BYDAY=FR,SA/g) || []).length, 1);
  assert.equal((ics.match(/SEQUENCE:2/g) || []).length, 4);
  assert.ok(ics.includes('UID:hold-the-line@fast.reminders'));
  // Every physical line fits in 75 octets and lines end with CRLF only.
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.ok(!/[^\r]\n/.test(ics));
});

test('ics: changed times move the events and change the fingerprint', () => {
  const later = { ...SETTINGS, workdayStart: '18:00' };
  const ics = buildIcs(later, { nowTs: T('2026-09-27T10:00'), todayKey: '2026-09-27' });
  assert.ok(ics.includes('DTSTART;TZID=Asia/Kuwait:20260927T180000'));
  assert.ok(ics.includes('opens at 18:00'));
  assert.notEqual(icsTimes(SETTINGS), icsTimes(later));
});

test('ics: escaping and folding', () => {
  assert.equal(escapeText('a, b; c\\d\ne'), 'a\\, b\\; c\\\\d\\ne');
  const long = 'DESCRIPTION:' + 'x'.repeat(200);
  const folded = foldLine(long);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1);
  assert.ok(parts.slice(1).every((p) => p.startsWith(' ')));
  assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(''), long);
});

test('csv: cells are escaped for Excel', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell(-0.5), '-0.5');
  assert.equal(csvCell(null), '');
  const text = toCsv(['a', 'b'], [[1, 'x']]);
  assert.ok(text.startsWith('﻿a,b\r\n1,x\r\n'));
});

function sample() {
  return {
    days: new Map([
      ['2026-09-20', { day: '2026-09-20', firstBite: T('2026-09-20T17:30'), lastBite: T('2026-09-20T21:50'), energy4pm: 4, trained: true, trainingType: 'weights' }],
      ['2026-09-25', { day: '2026-09-25', firstBite: T('2026-09-25T23:00'), lastBite: T('2026-09-26T01:30') }],
    ]),
    meals: [{ id: 1, day: '2026-09-20', name: 'Dinner, with rice', startedAt: T('2026-09-20T17:30'), finishedAt: T('2026-09-20T18:00'), hungerBefore: 7, stop: 'before_full', fullnessNow: 6, fullness20: 7 }],
    outside: [{ id: 1, day: '2026-09-20', at: T('2026-09-20T22:30'), trigger: 'boredom', amount: 'little' }],
    temptations: [{ id: 1, day: '2026-09-20', startedAt: T('2026-09-20T13:00'), endedAt: T('2026-09-20T13:10'), trigger: 'social', outcome: 'held', urges: [{ min: 0, value: 7 }, { min: 3, value: 4 }] }],
    weights: new Map([['2026-09-20', 104.6], ['2026-09-21', 104.3]]),
    settings: { ...SETTINGS, installedAt: T('2026-09-20T08:00') },
  };
}

test('csv: five files with the expected rows', () => {
  const files = buildCsvFiles(sample(), { nowTs: T('2026-09-26T12:00'), todayKey: '2026-09-26', startKey: '2026-09-20' });
  assert.deepEqual(files.map((f) => f.name), ['fast-windows.csv', 'fast-meals.csv', 'fast-weight.csv', 'fast-checkins.csv', 'fast-temptations.csv']);
  const rows = (name) => files.find((f) => f.name === name).text.replace('﻿', '').trim().split('\r\n');
  const windows = rows('fast-windows.csv');
  assert.equal(windows[0], 'date,weekday,day_type,first_bite,last_bite,last_bite_date,length_min,result,reasons,over_by_min,opened_before_16,outside_eating');
  assert.equal(windows[1], '2026-09-20,Sunday,workday,17:30,21:50,2026-09-20,260,miss,over 4 h 15 min; ate outside the window,20,no,1');
  assert.equal(windows[2], '2026-09-25,Friday,weekend,23:00,01:30,2026-09-26,150,success,,,no,0');
  const meals = rows('fast-meals.csv');
  assert.equal(meals[1], '2026-09-20,meal,"Dinner, with rice",17:30,18:00,7,before full,6,7,,');
  assert.equal(meals[2], '2026-09-20,outside the window,,22:30,,,,,,boredom,little');
  assert.deepEqual(rows('fast-weight.csv'), ['date,kg', '2026-09-20,104.6', '2026-09-21,104.3']);
  assert.deepEqual(rows('fast-checkins.csv'), ['date,weekday,day_type,energy_4pm,trained,training_type', '2026-09-20,Sunday,workday,4,yes,weights']);
  assert.deepEqual(rows('fast-temptations.csv'), ['date,time,trigger,outcome,urge_ratings,minutes', '2026-09-20,13:00,social,held,7 4,10']);
});

test('backup: round trip and validation messages', () => {
  const data = sample();
  const backup = buildBackup(data, { nowTs: T('2026-09-26T12:00'), version: 'test' });
  const parsed = parseBackup(JSON.stringify(backup));
  assert.deepEqual(parsed.data, JSON.parse(JSON.stringify(backup)).data);
  assert.equal(parsed.skipped, 0);
  assert.deepEqual(describeBackup(parsed), { exportedAt: '2026-09-26T09:00:00.000Z', windows: 2, meals: 1, weighIns: 2, temptations: 1, skipped: 0 });

  assert.throws(() => parseBackup('not json'), /not a Fast backup/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'other' })), /not a Fast backup/);
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, schema: 99 })), /newer version/);
  const broken = JSON.parse(JSON.stringify(backup));
  delete broken.data.meals;
  assert.throws(() => parseBackup(JSON.stringify(broken)), /incomplete/);
  // A damaged entry is left out instead of blocking the whole restore.
  const damaged = JSON.parse(JSON.stringify(backup));
  damaged.data.weights[0].kg = 'heavy';
  damaged.data.meals.push({ fullness20: 7 }); // a half-empty record
  const partial = parseBackup(JSON.stringify(damaged));
  assert.equal(partial.skipped, 2);
  assert.equal(partial.data.weights.length, 1);
  assert.equal(partial.data.meals.length, 1);
  assert.equal(describeBackup(partial).skipped, 2);
});
