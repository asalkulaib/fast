// Builds the reminders calendar file (.ics, RFC 5545). Pure functions only.

import { addDays, keyParts, toMinutes, weekday } from './time.js';

const CRLF = '\r\n';
const WORK = ['SU', 'MO', 'TU', 'WE', 'TH'];
const WEEKEND = ['FR', 'SA'];
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const EVENT_UIDS = ['hold-the-line', 'training', 'window-workday', 'window-weekend'];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets; continuation lines start with one space. */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (len + size > limit) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += size;
  }
  out.push(cur);
  return out.join(CRLF + ' ');
}

function utcStamp(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** First day on or after fromKey whose weekday is in the list. */
function firstMatching(fromKey, codes) {
  for (let i = 0; i < 7; i++) {
    const k = addDays(fromKey, i);
    if (codes.includes(DAY_CODES[weekday(k)])) return k;
  }
  return fromKey;
}

function localStamp(key, hhmm) {
  const { y, m, d } = keyParts(key);
  const min = toMinutes(hhmm);
  return `${y}${pad(m)}${pad(d)}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
}

/** The four repeating reminders, from the current settings. */
export function reminderEvents(s) {
  return [
    { uid: 'hold-the-line', days: WORK, time: s.holdTime, summary: 'Hold the line', description: `Your window opens at ${s.workdayStart}. Water, black coffee, espresso or plain tea until then.` },
    { uid: 'training', days: WORK, time: s.trainingTime, summary: 'Training', description: `Train before your window opens at ${s.workdayStart}. Log your 4 PM energy in Fast.` },
    { uid: 'window-workday', days: WORK, time: s.workdayStart, summary: 'Window opens', description: 'Protein and vegetables first. Eat slowly. Pause halfway.' },
    { uid: 'window-weekend', days: WEEKEND, time: s.weekendStart, summary: 'Window opens', description: 'Protein and vegetables first. Eat slowly. Pause halfway.' },
  ];
}

/**
 * settings: { workdayStart, weekendStart, holdTime, trainingTime }
 * opts: { nowTs, todayKey, sequence }
 */
export function buildIcs(settings, { nowTs, todayKey, sequence = 0 }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fast//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Fast',
    'X-WR-TIMEZONE:Asia/Kuwait',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Kuwait',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:+03',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const ev of reminderEvents(settings)) {
    const start = firstMatching(todayKey, ev.days);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}@fast.reminders`,
      `DTSTAMP:${utcStamp(nowTs)}`,
      `SEQUENCE:${sequence}`,
      `DTSTART;TZID=Asia/Kuwait:${localStamp(start, ev.time)}`,
      'DURATION:PT10M',
      `RRULE:FREQ=WEEKLY;BYDAY=${ev.days.join(',')}`,
      `SUMMARY:${escapeText(ev.summary)}`,
      `DESCRIPTION:${escapeText(ev.description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(ev.summary)}`,
      'TRIGGER:-PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** The times a calendar file was built from, to tell when it is out of date. */
export function icsTimes(s) {
  return [s.holdTime, s.trainingTime, s.workdayStart, s.weekendStart].join('|');
}
