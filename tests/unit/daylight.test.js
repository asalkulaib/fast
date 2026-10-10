import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_PHASES, dayPhase, sunTimes } from '../../docs/js/core/daylight.js';
import { setZones } from '../../docs/js/core/time.js';

const T = (s) => Date.parse(`${s}:00+03:00`);
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

test('sunrise and sunset in Kuwait match the almanac within a few minutes', () => {
  // Almanac times for Kuwait City: 27 Sep 05:42 / 17:41; 21 Jun 04:48 / 18:50; 21 Dec 06:36 / 16:53.
  const near = (got, want) => assert.ok(Math.abs(got - want) <= 6, `${hhmm(got)} vs ${hhmm(want)}`);
  const at = (key) => sunTimes(key, 180, 47.98);
  near(at('2026-09-27').sunrise, 5 * 60 + 42);
  near(at('2026-09-27').sunset, 17 * 60 + 41);
  near(at('2026-06-21').sunrise, 4 * 60 + 48);
  near(at('2026-06-21').sunset, 18 * 60 + 50);
  near(at('2026-12-21').sunrise, 6 * 60 + 36);
  near(at('2026-12-21').sunset, 16 * 60 + 53);
});

test('the phases of a September day in Kuwait', () => {
  assert.deepEqual(DAY_PHASES, ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night']);
  const at = (hm) => dayPhase(T(`2026-09-27T${hm}`));
  assert.equal(at('04:30'), 'night');
  assert.equal(at('05:30'), 'dawn');
  assert.equal(at('07:30'), 'morning');
  assert.equal(at('12:00'), 'midday');
  assert.equal(at('15:30'), 'afternoon');
  assert.equal(at('17:30'), 'dusk');
  assert.equal(at('18:30'), 'night');
  assert.equal(at('23:59'), 'night');
});

test('away from home, the phase follows the clock where you are', () => {
  setZones([{ from: null, zone: 'Asia/Kuwait' }, { from: T('2026-09-27T00:00'), zone: 'Europe/London' }]);
  try {
    // London in late September, on summer time: sunrise about 06:57, solar noon about 12:51.
    assert.equal(dayPhase(Date.parse('2026-09-27T06:00:00+01:00')), 'night');
    assert.equal(dayPhase(Date.parse('2026-09-27T07:10:00+01:00')), 'dawn');
    assert.equal(dayPhase(Date.parse('2026-09-27T13:00:00+01:00')), 'midday');
    assert.equal(dayPhase(Date.parse('2026-09-27T19:00:00+01:00')), 'dusk');
  } finally {
    setZones([]);
  }
});
