import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, SOURCES, AUTOPHAGY_NOTE, fastingState, stageIndex } from '../../docs/js/core/stages.js';

const H = 3_600_000;
const M = 60_000;

test('stages cover the whole clock without gaps', () => {
  assert.equal(STAGES[0].from, 0);
  for (let i = 1; i < STAGES.length; i++) assert.equal(STAGES[i].from, STAGES[i - 1].to);
  assert.equal(STAGES.at(-1).to, Infinity);
});

test('stage boundaries at 4, 12 and 24 hours', () => {
  assert.equal(stageIndex(0), 0);
  assert.equal(stageIndex(4 * H - M), 0);
  assert.equal(stageIndex(4 * H), 1);
  assert.equal(stageIndex(12 * H - M), 1);
  assert.equal(stageIndex(12 * H), 2);
  assert.equal(stageIndex(24 * H - M), 2);
  assert.equal(stageIndex(24 * H), 3);
  assert.equal(stageIndex(72 * H), 3);
});

test('fasting state: stage, next stage and position on the 24-hour scale', () => {
  const last = Date.parse('2026-09-26T21:00:00+03:00');
  const s = fastingState(last, last + 16 * H + 10 * M);
  assert.equal(s.stage.name, 'Metabolic switch');
  assert.equal(s.next.name, 'Ketones climbing');
  assert.equal(s.untilNextMs, 7 * H + 50 * M);
  assert.ok(Math.abs(s.position - (16 + 10 / 60) / 24) < 1e-9);
  const long = fastingState(last, last + 30 * H);
  assert.equal(long.stage.name, 'Ketones climbing');
  assert.equal(long.next, null);
  assert.equal(long.position, 1);
});

test('the copy stays within the evidence', () => {
  const all = [...STAGES.map((s) => s.text), AUTOPHAGY_NOTE].join(' ');
  // No stage claims autophagy at an hour, and no stage promises ketosis as a certainty.
  assert.doesNotMatch(STAGES.map((s) => `${s.name} ${s.text}`).join(' '), /autophagy/i);
  assert.doesNotMatch(all, /you are in ketosis/i);
  assert.match(AUTOPHAGY_NOTE, /not known/);
  assert.equal(SOURCES.length, 6);
});
