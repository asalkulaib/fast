// CSV exports for Excel: UTF-8 with BOM, CRLF line ends, ISO dates, 24-hour times.

import { dayKey, fmtTime, minutesOfDay, weekdayName } from './time.js';
import { CUTOFF_MIN, isWorkday, makeEvaluator } from './rules.js';

const REASON_TEXT = { early: 'opened before 16:00', over: 'over 4 h 15 min', outside: 'ate outside the window' };
const STOP_TEXT = { before_full: 'before full', full: 'full', stuffed: 'stuffed' };
const OUTCOME_TEXT = { held: 'held', opened_early: 'opened window early', ate_little: 'ate a little outside the window', ate_outside: 'ate outside the window' };

export function csvCell(value) {
  if (value == null) return '';
  let s = String(value);
  // Text that starts like a formula is kept as text in Excel.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const time = (ts) => (ts ? fmtTime(ts) : null);
const minutes = (ms) => Math.round(ms / 60000);

function dayType(key, rec) {
  if (rec && rec.dayOff) return 'day off';
  return isWorkday(key, rec) ? 'workday' : 'weekend';
}

/**
 * data: { days: Map, meals: [], outside: [], temptations: [], weights: Map }
 * Returns [{ name, text }] for windows, meals, weight, check-ins and temptations.
 */
export function buildCsvFiles(data, { nowTs, todayKey, startKey }) {
  const evaluate = makeEvaluator({ days: data.days, outside: data.outside, nowTs, todayKey, startKey });
  const dayKeys = [...data.days.keys()].sort();
  const outsideKeys = new Set(data.outside.map((o) => o.day));
  const windowKeys = [...new Set([...dayKeys.filter((k) => {
    const r = data.days.get(k);
    return r.firstBite || r.noEating;
  }), ...outsideKeys])].sort();

  const windows = toCsv(
    ['date', 'weekday', 'day_type', 'first_bite', 'last_bite', 'last_bite_date', 'length_min', 'result', 'reasons', 'over_by_min', 'opened_before_16', 'outside_eating'],
    windowKeys.map((k) => {
      const rec = data.days.get(k);
      const e = evaluate(k);
      const result = e.state === 'open' ? 'open' : e.state === 'noEating' && e.result === 'success' ? 'no eating' : e.result;
      return [
        k, weekdayName(k), dayType(k, rec),
        time(e.firstBite), time(e.lastBite), e.lastBite ? dayKey(e.lastBite) : null,
        e.firstBite && e.lastBite ? minutes(e.lengthMs) : null,
        result,
        e.reasons.map((r) => REASON_TEXT[r]).join('; ') || null,
        e.overByMs ? minutes(e.overByMs) : null,
        e.firstBite ? (minutesOfDay(e.firstBite) < CUTOFF_MIN ? 'yes' : 'no') : null,
        e.outsideCount,
      ];
    }),
  );

  const mealRows = [
    ...data.meals.map((m) => ({ sort: m.startedAt, row: [
      m.day, 'meal', m.name || null, time(m.startedAt), time(m.finishedAt), m.hungerBefore ?? null,
      m.stop ? STOP_TEXT[m.stop] : null, m.fullnessNow ?? null, m.fullness20 ?? null, null, null,
    ] })),
    ...data.outside.map((o) => ({ sort: o.at, row: [
      o.day, 'outside the window', null, time(o.at), null, null, null, null, null, o.trigger || null, o.amount || null,
    ] })),
  ].sort((a, b) => a.sort - b.sort).map((x) => x.row);
  const meals = toCsv(
    ['date', 'kind', 'name', 'start', 'finish', 'hunger_before', 'stopped', 'fullness_after', 'fullness_20min', 'trigger', 'amount'],
    mealRows,
  );

  const weight = toCsv(
    ['date', 'kg'],
    [...data.weights.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, kg]) => [date, kg]),
  );

  const checkins = toCsv(
    ['date', 'weekday', 'day_type', 'energy_4pm', 'trained', 'training_type'],
    dayKeys
      .map((k) => [k, data.days.get(k)])
      .filter(([, r]) => r.energy4pm != null || r.trained != null || r.dayOff)
      .map(([k, r]) => [k, weekdayName(k), dayType(k, r), r.energy4pm ?? null, r.trained == null ? null : r.trained ? 'yes' : 'no', r.trained ? r.trainingType || null : null]),
  );

  const temptations = toCsv(
    ['date', 'time', 'trigger', 'outcome', 'urge_ratings', 'minutes'],
    [...data.temptations].sort((a, b) => a.startedAt - b.startedAt).map((t) => [
      t.day, time(t.startedAt), t.trigger || null, t.outcome ? OUTCOME_TEXT[t.outcome] : null,
      (t.urges || []).map((u) => u.value).join(' ') || null,
      t.endedAt ? minutes(t.endedAt - t.startedAt) : null,
    ]),
  );

  return [
    { name: 'fast-windows.csv', text: windows },
    { name: 'fast-meals.csv', text: meals },
    { name: 'fast-weight.csv', text: weight },
    { name: 'fast-checkins.csv', text: checkins },
    { name: 'fast-temptations.csv', text: temptations },
  ];
}
