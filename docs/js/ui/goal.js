// The goal: an eating window of 16:8, 18:6, 20:4, 23:1 or any whole number
// of hours from 1 to 12; the fasting goal is the rest of the 24 hours.
// A change applies from today on; past days keep the goal they had.

import { h } from './dom.js';
import { choice, optionWheel } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import * as store from '../store.js';
import { HOUR } from '../core/time.js';
import { GOAL_HOURS_MAX, GOAL_PRESETS, goalLabel } from '../core/rules.js';

const hours = (n) => `${n} ${n === 1 ? 'hour' : 'hours'}`;

/** 'Eating window 4 hours, fasting 20 hours.' */
export function goalText(windowMs) {
  const w = Math.round(windowMs / HOUR);
  return `Eating window ${hours(w)}, fasting ${hours(24 - w)}.`;
}

let customOpen = false; // the custom wheel stays open once chosen

/** The goal choices; redraw() refreshes whatever holds them. */
function goalControls(app, redraw) {
  const ctx = app.ctx();
  const current = Math.round(ctx.windowMsFor(ctx.todayKey) / HOUR);
  const custom = customOpen || !GOAL_PRESETS.includes(current);
  const set = async (windowHours) => {
    if (windowHours === app.ctx().windowMsFor(ctx.todayKey) / HOUR) return;
    const { undo } = await store.setGoal(windowHours, ctx.todayKey);
    redraw();
    app.flash(`Goal ${goalLabel(windowHours * HOUR)} from today.`, { undo });
  };
  return h('div', { 'data-block': 'goal-controls' },
    choice({
      options: [...GOAL_PRESETS.map((v) => ({ value: v, label: goalLabel(v * HOUR) })), { value: 'custom', label: 'Custom' }],
      value: custom ? 'custom' : current,
      cols: 5,
      name: 'goal',
      onChange: (v) => {
        customOpen = v === 'custom';
        if (customOpen) redraw();
        else set(v);
      },
    }),
    custom
      ? h('div', { class: 'gap' }, optionWheel({
        label: 'Eating window',
        options: Array.from({ length: GOAL_HOURS_MAX }, (_, i) => ({ value: i + 1, label: hours(i + 1) })),
        value: current,
        name: 'goal-hours',
        onChange: set,
      }))
      : null,
    h('p', { class: 'gap-s', 'data-testid': 'goal-text' }, goalText(current * HOUR)),
    h('p', { class: 'small quiet gap-s' }, 'A change applies from today on. Past days keep the goal they had.'));
}

/** The Goal section on More. */
export function goalSection(ctx, app) {
  return h('section', { class: 'section', 'data-block': 'goal' },
    h('div', { class: 'label' }, 'Goal'),
    h('div', { class: 'gap-s' }, goalControls(app, () => app.refresh())));
}

/** The same choices in a sheet, from the Goal note on Today. */
export function showGoalSheet(app) {
  openSheet((api) => h('div', {},
    sheetHead(api, 'Goal'),
    h('p', {}, 'Choose your eating window. The fast is the rest of the day.'),
    h('section', { class: 'section gap' }, goalControls(app, () => api.rerender()))),
  { name: 'goal', label: 'Goal' });
}
