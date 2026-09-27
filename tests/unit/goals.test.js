import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../../docs/js/core/rules.js';
import { dailySeries } from '../../docs/js/core/history.js';
import { LEFT_WANTING, dayFullness } from '../../docs/js/core/fullness.js';
import { SUMMIT, climb, climbers, switchClimber, wasOff } from '../../docs/js/core/climb.js';

// Goals, fullness and the Uhud climb.

const T = (s) => Date.parse(`${s}:00+03:00`);
const H = 3_600_000;
const MIN = 60_000;
const win = (day, first, last, extra = {}) => ({ day, firstBite: T(`${day}T${first}`), lastBite: last ? T(`${day}T${last}`) : null, ...extra });
const days = (...recs) => new Map(recs.map((r) => [r.day, r]));

test('the eating-window goal: 4 hours unless changed, and a change applies from its day on', () => {
  assert.equal(rules.windowMsFor('2026-09-20', {}), 4 * H);
  const settings = { goalChanges: [{ from: '2026-09-22', hours: 8 }, { from: '2026-09-25', hours: 6 }] };
  assert.equal(rules.windowMsFor('2026-09-21', settings), 4 * H);
  assert.equal(rules.windowMsFor('2026-09-22', settings), 8 * H);
  assert.equal(rules.windowMsFor('2026-09-24', settings), 8 * H);
  assert.equal(rules.windowMsFor('2026-09-30', settings), 6 * H);
  assert.equal(rules.goalLabel(8 * H), '16:8');
  assert.equal(rules.goalLabel(H), '23:1');
});

test('a day is judged by the goal it had: 7 h passes on 16:8, not on 20:4', () => {
  const d = days(win('2026-09-21', '16:00', '23:00'), win('2026-09-22', '16:00', '23:00'), win('2026-09-23', '16:00', '00:30'));
  d.set('2026-09-23', { ...d.get('2026-09-23'), lastBite: T('2026-09-24T00:30') });
  const settings = { goalChanges: [{ from: '2026-09-22', hours: 8 }] };
  const evaluate = rules.makeEvaluator({ days: d, outside: [], nowTs: T('2026-09-26T12:00'), todayKey: '2026-09-26', startKey: '2026-09-21', settings });
  assert.equal(evaluate('2026-09-21').result, 'miss'); // 7 h on the old 4-hour goal
  assert.equal(evaluate('2026-09-21').overByMs, 3 * H);
  assert.equal(evaluate('2026-09-22').result, 'success'); // 7 h on 16:8
  assert.equal(evaluate('2026-09-23').result, 'miss'); // 8 h 30 min is past 8 h 15 min
  assert.equal(evaluate('2026-09-23').overByMs, 30 * MIN);
});

test('with a longer goal, the countdown phases and the forgotten close follow it', () => {
  const rec = win('2026-09-27', '16:00', null);
  assert.equal(rules.windowPhase(rec, T('2026-09-27T21:00'), 8 * H), 'window');
  assert.equal(rules.windowPhase(rec, T('2026-09-27T23:40'), 8 * H), 'warn');
  assert.equal(rules.windowPhase(rec, T('2026-09-28T00:05'), 8 * H), 'grace');
  assert.equal(rules.windowPhase(rec, T('2026-09-28T00:20'), 8 * H), 'over');
  const settings = { goalChanges: [{ from: '2026-09-27', hours: 8 }] };
  const d = days(rec);
  // Six hours in is still inside an 8-hour window; ten hours in asks for the last bite.
  assert.equal(rules.todayMode({ days: d, todayKey: '2026-09-27', nowTs: T('2026-09-27T22:00'), settings }).mode, 'open');
  assert.equal(rules.todayMode({ days: d, todayKey: '2026-09-28', nowTs: T('2026-09-28T02:00'), settings }).mode, 'forgot');
  assert.equal(rules.canReopen(win('2026-09-27', '16:00', '19:00'), T('2026-09-27T23:00'), 8 * H), true);
});

test('Begin fast: a fast start counts as the start of the current fast, and History uses it', () => {
  const d = days(win('2026-09-25', '17:00', '21:00'), { day: '2026-09-26', fastFrom: T('2026-09-26T22:30') }, win('2026-09-27', '17:30', '21:30'));
  const src = rules.lastEatingSource({ days: d, meals: [], outside: [], todayKey: '2026-09-27' });
  assert.equal(src.kind, 'window');
  const before = rules.lastEatingSource({ days: days(win('2026-09-25', '17:00', '21:00'), { day: '2026-09-26', fastFrom: T('2026-09-26T22:30') }), meals: [], outside: [], todayKey: '2026-09-27' });
  assert.deepEqual([before.kind, before.ts], ['fast', T('2026-09-26T22:30')]);
  assert.equal(rules.lastBiteTs({ days: d, meals: [], outside: [] }), T('2026-09-27T21:30'));
  const s = dailySeries({ days: d, meals: [], outside: [] }, '2026-09-27', '2026-09-27');
  assert.equal(s[0].fastMs, T('2026-09-27T17:30') - T('2026-09-26T22:30'));
  // A fast begun on the last day of a pause still counts after the pause.
  const paused = days({ day: '2026-09-26', paused: 'travel', fastFrom: T('2026-09-26T21:00') });
  assert.equal(rules.lastEatingTs({ days: paused, meals: [], outside: [], todayKey: '2026-09-27' }), T('2026-09-26T21:00'));
});

test('a first fast begun last night does not make last night a tracked day', () => {
  const d = days({ day: '2026-09-26', fastFrom: T('2026-09-26T18:00') });
  const start = rules.trackingStart({ days: d, meals: [], outside: [], temptations: [], installedAt: T('2026-09-27T09:00') }, '2026-09-27');
  assert.equal(start, '2026-09-27');
  d.set('2026-09-25', win('2026-09-25', '17:00', '20:00'));
  assert.equal(rules.trackingStart({ days: d, meals: [], outside: [], temptations: [], installedAt: T('2026-09-27T09:00') }, '2026-09-27'), '2026-09-25');
});

test('a day is left wanting only when every meal was, or the day itself was rated so', () => {
  const m = (stop) => ({ stop });
  assert.equal(dayFullness([m('before_full'), m('before_full')], null), LEFT_WANTING);
  assert.equal(dayFullness([m('before_full'), m('full')], null), 'full');
  assert.equal(dayFullness([m('stuffed'), m('full')], null), 'stuffed');
  assert.equal(dayFullness([m('before_full'), m(null)], null), null); // one meal unrated
  assert.equal(dayFullness([m('before_full'), m(null)], { fullness: 'before_full' }), LEFT_WANTING);
  assert.equal(dayFullness([], { fullness: 'full' }), 'full'); // a paused day's own rating
  assert.equal(dayFullness([], null), null);
});

test('the climb: a step per qualifying day, 30 to the summit, never slipping back', () => {
  const qualifying = new Set(['2026-09-01', '2026-09-03', '2026-09-04']);
  const c = climb({ startKey: '2026-09-01', endKey: '2026-09-05', qualifies: (k) => qualifying.has(k), off: [] });
  assert.deepEqual(c, { steps: 3, summits: 0, step: 3 });
  assert.deepEqual(climb({ startKey: '2026-01-01', endKey: '2026-03-01', qualifies: () => true, off: [] }), { steps: 60, summits: 2, step: 0 });
  assert.equal(SUMMIT, 30);
  // Days switched off do not count.
  assert.equal(climb({ startKey: '2026-09-01', endKey: '2026-09-05', qualifies: () => true, off: [{ from: '2026-09-02', to: '2026-09-03' }] }).steps, 3);
  assert.equal(wasOff('2026-09-10', [{ from: '2026-09-08', to: null }]), true);
});

test('switching a climber off and on again leaves a gap only for the days it was off', () => {
  let c = { on: true, off: [] };
  c = switchClimber(c, false, '2026-09-10');
  assert.deepEqual(c, { on: false, off: [{ from: '2026-09-10', to: null }] });
  c = switchClimber(c, true, '2026-09-14');
  assert.deepEqual(c, { on: true, off: [{ from: '2026-09-10', to: '2026-09-13' }] });
  // Off and on within a day: no gap.
  assert.deepEqual(switchClimber(switchClimber({ on: true, off: [] }, false, '2026-09-20'), true, '2026-09-20'), { on: true, off: [] });
});

test('both climbers from the data: paused days hold the fast climber, not the fullness climber', () => {
  const d = days(
    win('2026-09-20', '17:30', '21:00'),
    { day: '2026-09-21', paused: 'travel', fullness: 'before_full' },
    win('2026-09-22', '17:30', '22:30'), // a miss: over 4 h 15 min
    win('2026-09-23', '17:30', '21:00'),
  );
  const meals = [
    { id: 1, day: '2026-09-20', stop: 'before_full' },
    { id: 2, day: '2026-09-22', stop: 'before_full' },
    { id: 3, day: '2026-09-23', stop: 'stuffed' },
  ];
  const settings = {};
  const evaluate = rules.makeEvaluator({ days: d, outside: [], nowTs: T('2026-09-24T12:00'), todayKey: '2026-09-24', startKey: '2026-09-20', settings });
  const c = climbers({ days: d, meals, evaluate, startKey: '2026-09-20', todayKey: '2026-09-24', settings });
  assert.equal(c.fast.steps, 2); // the 20th and the 23rd
  assert.equal(c.fullness.steps, 3); // the 20th, the paused 21st and the 22nd
  assert.equal(c.fast.on, true);
});
