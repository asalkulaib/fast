// The Jebel Uhud climb: two climbers, one step per qualifying day. Pure functions.
//
// Fast climber: one step for each successful day.
// Fullness climber: one step for each day left wanting, paused days included.
// Missed days hold a climber in place; nothing ever slips back. At 30 steps
// a climber stays on the summit and a new one starts from the base.
// A climber switched off does not track; switched on again, it resumes.

import { addDays } from './time.js';
import { LEFT_WANTING, dayFullness, mealsByDay } from './fullness.js';

export const SUMMIT = 30;

export const DEFAULT_CLIMB = { fast: { on: true, off: [] }, fullness: { on: true, off: [] } };

/** Whether a climber was switched off on a day: off holds [{ from, to|null }]. */
export function wasOff(key, off = []) {
  return off.some((r) => key >= r.from && (r.to == null || key <= r.to));
}

/** Steps from startKey to endKey: { steps, summits, step } where step is the place on the current climb. */
export function climb({ startKey, endKey, qualifies, off }) {
  let steps = 0;
  for (let k = startKey; k <= endKey; k = addDays(k, 1)) if (!wasOff(k, off) && qualifies(k)) steps++;
  return { steps, summits: Math.floor(steps / SUMMIT), step: steps % SUMMIT };
}

/**
 * Both climbers from the app's data (a context with days, meals, evaluate,
 * startKey, todayKey and settings).
 */
export function climbers(ctx) {
  const cfg = { ...DEFAULT_CLIMB, ...(ctx.settings.climb || {}) };
  const byDay = mealsByDay(ctx.meals);
  const range = { startKey: ctx.startKey, endKey: ctx.todayKey };
  return {
    fast: { ...cfg.fast, ...climb({ ...range, off: cfg.fast.off, qualifies: (k) => ctx.evaluate(k).result === 'success' }) },
    fullness: {
      ...cfg.fullness,
      ...climb({ ...range, off: cfg.fullness.off, qualifies: (k) => dayFullness(byDay.get(k) || [], ctx.days.get(k)) === LEFT_WANTING }),
    },
  };
}

/**
 * Switching a climber off opens a range of days it does not track; switching
 * it on closes that range the day before. Off and on within one day leaves
 * no gap. Returns the climber's new setting.
 */
export function switchClimber(cur, on, todayKey) {
  const off = [...(cur.off || [])];
  if (!on && cur.on) off.push({ from: todayKey, to: null });
  if (on && !cur.on) {
    const last = off[off.length - 1];
    if (last && last.to == null) {
      const to = addDays(todayKey, -1);
      off.splice(off.length - 1, 1, ...(to < last.from ? [] : [{ from: last.from, to }]));
    }
  }
  return { on, off };
}
