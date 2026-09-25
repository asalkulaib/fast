// The fasting rules. Pure functions only: no DOM, no storage.
//
// A day record looks like:
//   { day: 'YYYY-MM-DD', firstBite: ms|null, lastBite: ms|null,
//     noEating: bool, dayOff: bool, energy4pm: 1-5|null,
//     trained: bool|null, trainingType: string|null }

import { HOUR, MIN, addDays, dayKey, dayStart, minutesOfDay, isWorkweekday, toMinutes } from './time.js';

export const WINDOW_MS = 4 * HOUR;
export const GRACE_MS = 15 * MIN;
export const LIMIT_MS = WINDOW_MS + GRACE_MS;
export const WARN_MS = 30 * MIN;
export const CUTOFF_MIN = 16 * 60; // workday rule: the window may open at 16:00 or later
export const FORGOT_MS = 6 * HOUR; // an open window this old asks for its last bite
export const LATE_NIGHT_END_MIN = 4 * 60; // 00:00 to 04:00 can be logged against last night

/** Sun to Thu is a workday unless the day is marked as a day off. */
export function isWorkday(key, rec) {
  return isWorkweekday(key) && !(rec && rec.dayOff);
}

export function hasWindow(rec) {
  return !!(rec && rec.firstBite);
}

export function isOpen(rec) {
  return !!(rec && rec.firstBite && !rec.lastBite);
}

/** Planned window start for a day, in minutes since midnight. */
export function plannedStartMin(key, rec, settings) {
  return toMinutes(isWorkday(key, rec) ? settings.workdayStart : settings.weekendStart);
}

/**
 * Evaluates one day.
 * result: 'success' | 'miss' | 'pending' (today, not decided yet)
 *       | 'unlogged' (a past day with nothing logged) | 'none' (outside tracking)
 * reasons for a miss: 'early' (workday window opened before 16:00),
 *                     'over' (longer than 4 h 15 min), 'outside' (ate outside the window)
 */
export function evaluateDay(key, rec, outsideCount, nowTs, todayKey, startKey) {
  const workday = isWorkday(key, rec);
  const base = {
    day: key,
    workday,
    dayOff: !!(rec && rec.dayOff),
    weekend: !isWorkweekday(key),
    outsideCount: outsideCount || 0,
    firstBite: null,
    lastBite: null,
    lengthMs: 0,
    overByMs: 0,
    openedEarly: false,
  };
  if (hasWindow(rec)) {
    const open = !rec.lastBite;
    const end = open ? Math.max(nowTs, rec.firstBite) : rec.lastBite;
    const lengthMs = Math.max(0, end - rec.firstBite);
    const openedEarly = workday && minutesOfDay(rec.firstBite) < CUTOFF_MIN;
    const over = lengthMs > LIMIT_MS;
    const reasons = [];
    if (openedEarly) reasons.push('early');
    if (over) reasons.push('over');
    if (base.outsideCount > 0) reasons.push('outside');
    return {
      ...base,
      state: open ? 'open' : 'closed',
      firstBite: rec.firstBite,
      lastBite: rec.lastBite || null,
      lengthMs,
      overByMs: over ? lengthMs - WINDOW_MS : 0,
      openedEarly,
      reasons,
      result: reasons.length ? 'miss' : open ? 'pending' : 'success',
    };
  }
  if (base.outsideCount > 0) {
    return { ...base, state: rec && rec.noEating ? 'noEating' : 'none', reasons: ['outside'], result: 'miss' };
  }
  if (rec && rec.noEating) {
    return { ...base, state: 'noEating', reasons: [], result: 'success' };
  }
  let result = 'none';
  if (key === todayKey) result = 'pending';
  else if (key < todayKey && (!startKey || key >= startKey)) result = 'unlogged';
  return { ...base, state: 'none', reasons: [], result };
}

/** Counts outside-window eating events per day. */
export function countByDay(items) {
  const map = new Map();
  for (const it of items) map.set(it.day, (map.get(it.day) || 0) + 1);
  return map;
}

/** Builds a cached evaluator for any day. */
export function makeEvaluator({ days, outside, nowTs, todayKey, startKey }) {
  const outsideByDay = countByDay(outside);
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) {
      cache.set(key, evaluateDay(key, days.get(key), outsideByDay.get(key) || 0, nowTs, todayKey, startKey));
    }
    return cache.get(key);
  };
}

/**
 * Current streak as of endKey and the best streak up to endKey.
 * Pending days (today, or last night's window still inside its 4 hours)
 * are neutral: they neither count nor break a run.
 */
export function streaks(evaluate, endKey, startKey) {
  let current = 0;
  let k = endKey;
  while (k >= startKey && evaluate(k).result === 'pending') k = addDays(k, -1);
  while (k >= startKey && evaluate(k).result === 'success') {
    current++;
    k = addDays(k, -1);
  }
  let best = 0;
  let run = 0;
  for (let d = startKey; d <= endKey; d = addDays(d, 1)) {
    const r = evaluate(d).result;
    if (r === 'success') {
      run++;
      if (run > best) best = run;
    } else if (r !== 'pending') {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}

/** The first day the app tracks: install day, or the earliest data if older. */
export function trackingStart({ days, meals, outside, temptations, installedAt }, todayKey) {
  let start = installedAt ? dayKey(installedAt) : todayKey;
  const consider = (k) => { if (k && k < start) start = k; };
  for (const k of days.keys()) consider(k);
  for (const m of meals) consider(m.day);
  for (const o of outside) consider(o.day);
  for (const t of temptations) consider(t.day);
  return start > todayKey ? todayKey : start;
}

/** Every open window, newest first. */
export function openWindows(days) {
  return [...days.values()].filter(isOpen).sort((a, b) => b.firstBite - a.firstBite);
}

/**
 * What the Today screen shows.
 * mode: 'open' | 'forgot' | 'closed' | 'noEating' | 'before'
 */
export function todayMode({ days, todayKey, nowTs }) {
  const open = openWindows(days)[0];
  if (open) {
    if (nowTs - open.firstBite >= FORGOT_MS) return { mode: 'forgot', rec: open };
    return { mode: 'open', rec: open };
  }
  const rec = days.get(todayKey);
  if (hasWindow(rec)) return { mode: 'closed', rec };
  if (rec && rec.noEating) return { mode: 'noEating', rec };
  // Just after midnight, last night's window stays on screen while it can
  // still be reopened inside its 4 hours.
  const late = lateNightDay({ days, todayKey, nowTs });
  if (late && canReopen(days.get(late), nowTs)) return { mode: 'closed', rec: days.get(late) };
  return { mode: 'before', rec };
}

/**
 * Between 00:00 and 04:00, food can be logged against last night's closed
 * window instead of opening a new day. Returns that day's key, or null.
 */
export function lateNightDay({ days, todayKey, nowTs }) {
  if (minutesOfDay(nowTs) >= LATE_NIGHT_END_MIN) return null;
  if (hasWindow(days.get(todayKey))) return null;
  const y = addDays(todayKey, -1);
  const rec = days.get(y);
  return rec && rec.firstBite && rec.lastBite ? y : null;
}

/** Phase of an open window: 'window' | 'warn' | 'grace' | 'over'. */
export function windowPhase(rec, nowTs) {
  const elapsed = nowTs - rec.firstBite;
  if (elapsed > LIMIT_MS) return 'over';
  if (elapsed >= WINDOW_MS) return 'grace';
  if (WINDOW_MS - elapsed <= WARN_MS) return 'warn';
  return 'window';
}

/** Whether a closed window can still be reopened (inside its 4 hours). */
export function canReopen(rec, nowTs) {
  return !!(rec && rec.firstBite && rec.lastBite && nowTs - rec.firstBite < WINDOW_MS);
}

/** Latest eating time on record for a day (for time since last bite). */
export function lastEatingTs({ days, meals, outside }) {
  let last = null;
  const take = (t) => { if (t && (last === null || t > last)) last = t; };
  for (const r of days.values()) { take(r.lastBite); if (r.firstBite && !r.lastBite) take(r.firstBite); }
  for (const m of meals) take(m.finishedAt || m.startedAt);
  for (const o of outside) take(o.at);
  return last;
}

/**
 * Resolves an HH:MM entered for a last bite (or any time after the first bite)
 * to the first matching moment at or after the first bite, so 01:30 after a
 * 22:30 first bite lands on the next day.
 */
export function timeOnOrAfter(baseTs, minutes) {
  const ts = dayStart(dayKey(baseTs)) + minutes * MIN;
  return ts < baseTs ? ts + 24 * HOUR : ts;
}
