// The fasting rules. Pure functions only: no DOM, no storage.
//
// A day record looks like:
//   { day: 'YYYY-MM-DD', firstBite: ms|null, lastBite: ms|null,
//     noEating: bool, dayOff: bool, energy4pm: 1-5|null,
//     trained: bool|null, trainingType: string|null,
//     paused: 'travel'|'illness'|'ramadan'|'other'|true (absent when not paused),
//     fullness: 'before_full'|'full'|'stuffed' (the day's own rating, when asked),
//     fastFrom: ms (when a fast began, set with Begin fast) }
//
// The eating window is a goal: 4 hours (20:4) unless changed. A change
// applies from its day on, so past days keep the goal they had.

import { HOUR, MIN, addDays, dayKey, dayStart, minutesOfDay, isWorkweekday, toMinutes } from './time.js';

export const DEFAULT_WINDOW_HOURS = 4;
export const WINDOW_MS = DEFAULT_WINDOW_HOURS * HOUR; // the default goal, 20:4
export const GRACE_MS = 15 * MIN;
export const LIMIT_MS = WINDOW_MS + GRACE_MS;
export const WARN_MS = 30 * MIN;
export const CUTOFF_MIN = 16 * 60; // workday rule: the window may open at 16:00 or later
export const FORGOT_AFTER_MS = 2 * HOUR; // an open window this long past its goal asks for its last bite
export const LATE_NIGHT_END_MIN = 4 * 60; // 00:00 to 04:00 can be logged against last night

/** Goals as hours of eating in 24: 16:8, 18:6, 20:4 and one meal a day, 23:1. */
export const GOAL_PRESETS = [8, 6, 4, 1];
export const GOAL_HOURS_MAX = 12;

/**
 * The eating-window goal in force on a day, in ms: the latest change on or
 * before it (settings.goalChanges: [{ from: 'YYYY-MM-DD', hours }], oldest first).
 */
export function windowMsFor(key, settings) {
  let hours = DEFAULT_WINDOW_HOURS;
  for (const c of (settings && settings.goalChanges) || []) if (c.from <= key) hours = c.hours;
  return hours * HOUR;
}

/** '20:4' for a 4-hour window: fasting hours, then eating hours. */
export function goalLabel(windowMs) {
  const hours = Math.round(windowMs / HOUR);
  return `${24 - hours}:${hours}`;
}

export const PAUSE_REASONS = ['travel', 'illness', 'ramadan', 'other'];

/**
 * A paused day is not tracked: nothing is logged, and it neither counts
 * towards a streak nor breaks one.
 */
export function isPaused(rec) {
  return !!(rec && rec.paused);
}

/**
 * Paused days grouped into runs of consecutive days with the same reason:
 * [{ from, to, reason }], oldest first.
 */
export function pauseRuns(days) {
  const keys = [...days.values()].filter(isPaused).map((r) => r.day).sort();
  const runs = [];
  for (const k of keys) {
    const reason = days.get(k).paused;
    const last = runs[runs.length - 1];
    if (last && addDays(last.to, 1) === k && last.reason === reason) last.to = k;
    else runs.push({ from: k, to: k, reason });
  }
  return runs;
}

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
 *       | 'paused' (not tracked, whatever is logged)
 * reasons for a miss: 'early' (workday window opened before 16:00),
 *                     'over' (longer than the goal plus 15 min), 'outside' (ate outside the window)
 */
export function evaluateDay(key, rec, outsideCount, nowTs, todayKey, startKey, windowMs = WINDOW_MS) {
  const workday = isWorkday(key, rec);
  const base = {
    day: key,
    windowMs,
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
  if (isPaused(rec)) return { ...base, state: 'paused', paused: rec.paused, reasons: [], result: 'paused' };
  if (hasWindow(rec)) {
    const open = !rec.lastBite;
    const end = open ? Math.max(nowTs, rec.firstBite) : rec.lastBite;
    const lengthMs = Math.max(0, end - rec.firstBite);
    const openedEarly = workday && minutesOfDay(rec.firstBite) < CUTOFF_MIN;
    const over = lengthMs > windowMs + GRACE_MS;
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
      overByMs: over ? lengthMs - windowMs : 0,
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

/**
 * Builds a cached evaluator for any day. Eating outside the window counts
 * both entries logged outside it and meals started after it closed.
 */
export function makeEvaluator({ days, outside, meals = [], nowTs, todayKey, startKey, settings }) {
  const outsideByDay = countByDay([...outside, ...meals.filter((m) => m.outside)]);
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) {
      cache.set(key, evaluateDay(key, days.get(key), outsideByDay.get(key) || 0, nowTs, todayKey, startKey, windowMsFor(key, settings)));
    }
    return cache.get(key);
  };
}

/**
 * Current streak as of endKey and the best streak up to endKey.
 * Pending days (today, or last night's window still inside its goal)
 * and paused days are neutral: they neither count nor break a run.
 */
export function streaks(evaluate, endKey, startKey) {
  let current = 0;
  let k = endKey;
  while (k >= startKey && evaluate(k).result === 'pending') k = addDays(k, -1);
  for (; k >= startKey; k = addDays(k, -1)) {
    const r = evaluate(k).result;
    if (r === 'success') current++;
    else if (r !== 'paused') break;
  }
  let best = 0;
  let run = 0;
  for (let d = startKey; d <= endKey; d = addDays(d, 1)) {
    const r = evaluate(d).result;
    if (r === 'success') {
      run++;
      if (run > best) best = run;
    } else if (r !== 'pending' && r !== 'paused') {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}

/**
 * The first day the app tracks: install day, or the earliest data if older.
 * A day that only holds when a fast began (Begin fast) is not data: a first
 * fast begun last night does not make last night a tracked day.
 */
export function trackingStart({ days, meals, outside, temptations, installedAt }, todayKey) {
  let start = installedAt ? dayKey(installedAt) : todayKey;
  const consider = (k) => { if (k && k < start) start = k; };
  for (const [k, r] of days) {
    if (r.firstBite || r.lastBite || r.noEating || r.paused || r.dayOff || r.fullness || r.energy4pm != null || r.trained != null) consider(k);
  }
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
 * mode: 'open' | 'forgot' | 'closed' | 'noEating' | 'paused' | 'before'
 */
export function todayMode({ days, todayKey, nowTs, settings }) {
  const open = openWindows(days)[0];
  if (open) {
    if (nowTs - open.firstBite >= windowMsFor(open.day, settings) + FORGOT_AFTER_MS) return { mode: 'forgot', rec: open };
    return { mode: 'open', rec: open };
  }
  const rec = days.get(todayKey);
  if (isPaused(rec)) return { mode: 'paused', rec };
  if (hasWindow(rec)) return { mode: 'closed', rec };
  if (rec && rec.noEating) return { mode: 'noEating', rec };
  // Just after midnight, last night's window stays on screen while it can
  // still be reopened inside its window.
  const late = lateNightDay({ days, todayKey, nowTs });
  if (late && canReopen(days.get(late), nowTs, windowMsFor(late, settings))) return { mode: 'closed', rec: days.get(late) };
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
export function windowPhase(rec, nowTs, windowMs = WINDOW_MS) {
  const elapsed = nowTs - rec.firstBite;
  if (elapsed > windowMs + GRACE_MS) return 'over';
  if (elapsed >= windowMs) return 'grace';
  if (windowMs - elapsed <= WARN_MS) return 'warn';
  return 'window';
}

/** Whether a closed window can still be reopened (inside its goal). */
export function canReopen(rec, nowTs, windowMs = WINDOW_MS) {
  return !!(rec && rec.firstBite && rec.lastBite && nowTs - rec.firstBite < windowMs);
}

/** Whether any day from fromKey to toKey is paused. */
export function pausedBetween(days, fromKey, toKey) {
  for (const r of days.values()) if (r.paused && r.day >= fromKey && r.day <= toKey) return true;
  return false;
}

/** Whether a paused day falls between a moment and today: eating then went unrecorded. */
export function pausedSince(days, ts, todayKey) {
  return !!todayKey && pausedBetween(days, dayKey(ts), todayKey);
}

/**
 * Where the current fast began, so its time can be edited: the latest eating
 * on record, or a start set with Begin fast.
 * { ts, kind: 'window' | 'open' | 'meal' | 'outside' | 'fast', day, id? }, or null.
 * On a tie the window's own last bite wins. Unknown (null) when a pause
 * came after it, since eating during a pause is not recorded; a fast
 * started on a paused day itself still counts.
 */
export function lastEatingSource({ days, meals, outside, todayKey }, { fastStarts = true } = {}) {
  let best = null;
  const take = (ts, src) => { if (ts && (!best || ts > best.ts)) best = { ts, ...src }; };
  for (const r of days.values()) {
    take(r.lastBite, { kind: 'window', day: r.day });
    if (r.firstBite && !r.lastBite) take(r.firstBite, { kind: 'open', day: r.day });
  }
  for (const m of meals) take(m.finishedAt || m.startedAt, { kind: 'meal', day: m.day, id: m.id });
  for (const o of outside) take(o.at, { kind: 'outside', day: o.day, id: o.id });
  if (fastStarts) for (const r of days.values()) take(r.fastFrom, { kind: 'fast', day: r.day });
  if (!best) return null;
  const from = best.kind === 'fast' ? addDays(dayKey(best.ts), 1) : dayKey(best.ts);
  return todayKey && pausedBetween(days, from, todayKey) ? null : best;
}

/** The latest eating on record (windows, meals, eating outside), ignoring fast starts; null when none. */
export function lastBiteTs({ days, meals, outside }) {
  let last = null;
  const take = (t) => { if (t && (last === null || t > last)) last = t; };
  for (const r of days.values()) { take(r.lastBite); if (r.firstBite && !r.lastBite) take(r.firstBite); }
  for (const m of meals) take(m.finishedAt || m.startedAt);
  for (const o of outside) take(o.at);
  return last;
}

/** Latest eating time on record (for time since last bite), or null. */
export function lastEatingTs(data) {
  const src = lastEatingSource(data);
  return src ? src.ts : null;
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
