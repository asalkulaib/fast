// Daily fast and feast hours for the History tab. Pure functions only.
//
// Feast: that day's window, first bite to last bite (closed windows only).
// Fast:  the fast that ended that day, from the latest eating before that
//        day's first bite to that first bite. Unknown before the first
//        eating on record, so the first tracked day has no fast.

import { HOUR, addDays } from './time.js';

/** Every moment of eating on record, oldest first. */
function eatingTimes({ days, meals, outside }) {
  const times = [];
  for (const r of days.values()) {
    if (r.firstBite) times.push(r.firstBite);
    if (r.lastBite) times.push(r.lastBite);
  }
  for (const m of meals) {
    if (m.startedAt) times.push(m.startedAt);
    if (m.finishedAt) times.push(m.finishedAt);
  }
  for (const o of outside) times.push(o.at);
  return times.sort((a, b) => a - b);
}

/** Latest time in a sorted list strictly before ts, or null. */
function latestBefore(sorted, ts) {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < ts) {
      found = sorted[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * One entry per day from fromKey to toKey (inclusive):
 * { day, fastMs, feastMs } with null where there is nothing to show.
 */
export function dailySeries(data, fromKey, toKey) {
  const times = eatingTimes(data);
  const out = [];
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) {
    const rec = data.days.get(k);
    let fastMs = null;
    let feastMs = null;
    if (rec && rec.firstBite) {
      const before = latestBefore(times, rec.firstBite);
      if (before != null) fastMs = rec.firstBite - before;
      if (rec.lastBite) feastMs = rec.lastBite - rec.firstBite;
    }
    out.push({ day: k, fastMs, feastMs });
  }
  return out;
}

/** Average and count of the non-empty values of one metric. */
export function summarize(series, metric) {
  const values = series.map((d) => d[metric]).filter((v) => v != null);
  return {
    count: values.length,
    avgMs: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
  };
}

/** A clean top for the hour axis and its step. */
export function hourScale(maxMs) {
  const hours = Math.max(1, maxMs / HOUR);
  const step = [1, 2, 4, 6, 8, 12, 24].find((s) => hours / s <= 4) || 24;
  return { step, top: Math.ceil(hours / step) * step };
}
