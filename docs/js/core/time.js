// Kuwait time helpers.
// Every stored time is epoch milliseconds (UTC). Local values use a fixed
// UTC+3 offset (Kuwait has no daylight saving), so day and week boundaries
// never depend on the phone's own time zone setting.

export const OFFSET_MIN = 180;
const OFFSET_MS = OFFSET_MIN * 60000;

export const MIN = 60000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const now = () => Date.now();

const pad = (n) => String(n).padStart(2, '0');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Local calendar parts of a timestamp. wd: 0 = Sunday. */
export function parts(ts) {
  const d = new Date(ts + OFFSET_MS);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
    hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds(), wd: d.getUTCDay(),
  };
}

/** Local day key, 'YYYY-MM-DD'. */
export function dayKey(ts) {
  const p = parts(ts);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function isDayKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { y, m, d } = keyParts(key);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function keyParts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** Epoch ms of local midnight at the start of a day. */
export function dayStart(key) {
  const { y, m, d } = keyParts(key);
  return Date.UTC(y, m - 1, d) - OFFSET_MS;
}

/** 'HH:MM' or minutes since midnight to minutes. */
export function toMinutes(hhmm) {
  if (typeof hhmm === 'number') return hhmm;
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/** Epoch ms of a local time on a given day. */
export function at(key, hhmm) {
  return dayStart(key) + toMinutes(hhmm) * MIN;
}

/**
 * The moment with this clock time nearest to ref (at most 12 hours away).
 * Used when an existing time is edited, so it stays on its own day.
 */
export function nearestTime(ref, minutes) {
  const base = dayStart(dayKey(ref)) + minutes * MIN;
  return [base - DAY, base, base + DAY].reduce((best, ts) => (Math.abs(ts - ref) < Math.abs(best - ref) ? ts : best));
}

/** Local minutes since midnight. */
export function minutesOfDay(ts) {
  const p = parts(ts);
  return p.hh * 60 + p.mm;
}

/** Drop seconds and milliseconds, so logged times match what is displayed. */
export function floorToMinute(ts) {
  return Math.floor(ts / MIN) * MIN;
}

export function addDays(key, n) {
  const { y, m, d } = keyParts(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(key) {
  const { y, m, d } = keyParts(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Sunday to Thursday. */
export function isWorkweekday(key) {
  return weekday(key) <= 4;
}

/** The Sunday that starts the week containing this day. */
export function weekStart(key) {
  return addDays(key, -weekday(key));
}

export function daysBetween(a, b) {
  return Math.round((dayStart(b) - dayStart(a)) / DAY);
}

export function fmtTime(ts) {
  const p = parts(ts);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

export function fmtMinutes(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Parses 'HH:MM', 'H:MM', 'HHMM' or 'HMM' into minutes, or null. */
export function parseClock(text) {
  const s = String(text || '').trim();
  let h, m;
  let match = s.match(/^(\d{1,2})[:.h ]?(\d{2})$/);
  if (match) { h = Number(match[1]); m = Number(match[2]); }
  else if ((match = s.match(/^(\d{1,2})$/))) { h = Number(match[1]); m = 0; }
  else return null;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export const weekdayName = (key) => WEEKDAYS[weekday(key)];
export const weekdayShort = (key) => WEEKDAYS[weekday(key)].slice(0, 3);

/** 'Friday 25 September' */
export function fmtDayLong(key) {
  const { m, d } = keyParts(key);
  return `${weekdayName(key)} ${d} ${MONTHS[m - 1]}`;
}

/** 'Fri 25 Sep' */
export function fmtDayShort(key) {
  const { m, d } = keyParts(key);
  return `${weekdayShort(key)} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** '25 Sep' */
export function fmtDayMonth(key) {
  const { m, d } = keyParts(key);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** '20 to 26 September' or '27 September to 3 October' */
export function fmtWeekRange(startKey) {
  const endKey = addDays(startKey, 6);
  const a = keyParts(startKey);
  const b = keyParts(endKey);
  if (a.m === b.m) return `${a.d} to ${b.d} ${MONTHS[b.m - 1]}`;
  return `${a.d} ${MONTHS[a.m - 1]} to ${b.d} ${MONTHS[b.m - 1]}`;
}

/** '3 h 52 min', '52 min', '4 h' */
export function fmtDuration(ms) {
  const total = Math.round(Math.max(0, ms) / MIN);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Elapsed time for margin notes: '19 h 20 min', or '6 days 12 h' past two days. */
export function fmtElapsed(ms) {
  if (ms < 2 * DAY) return fmtDuration(ms);
  const hours = Math.floor(ms / HOUR);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days} days ${rest} h` : `${days} days`;
}

/** Countdown 'H:MM', rounded up so it reads 0:00 only at the deadline. */
export function fmtCountdown(ms) {
  const mins = Math.max(0, Math.ceil(ms / MIN));
  return `${Math.floor(mins / 60)}:${pad(mins % 60)}`;
}

/** Short timer 'M:SS', rounded up. */
export function fmtTimer(ms) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(secs / 60)}:${pad(secs % 60)}`;
}

/** Time relative to today: '21:05', '21:05 yesterday', '21:05 Thu 24 Sep'. */
export function fmtWhen(ts, todayKey) {
  const k = dayKey(ts);
  if (k === todayKey) return fmtTime(ts);
  if (k === addDays(todayKey, -1)) return `${fmtTime(ts)} yesterday`;
  if (k === addDays(todayKey, 1)) return `${fmtTime(ts)} tomorrow`;
  return `${fmtTime(ts)} ${fmtDayShort(k)}`;
}
