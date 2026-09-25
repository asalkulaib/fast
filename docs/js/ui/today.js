// Today: the eating window.

import { h, hl, live } from './dom.js';
import { button, choice, scale, timeField, TRAINING_OPTIONS, STOP_TEXT } from './components.js';
import * as store from '../store.js';
import {
  MIN, fmtCountdown, fmtDayLong, fmtDuration, fmtElapsed, fmtMinutes, fmtTime, fmtWhen, isWorkweekday, minutesOfDay, now,
} from '../core/time.js';
import {
  CUTOFF_MIN, LIMIT_MS, WINDOW_MS, canReopen, isWorkday, lastEatingTs, lateNightDay, plannedStartMin, timeOnOrAfter, windowPhase,
} from '../core/rules.js';
import { dunes } from './art.js';
import { firstBite, forgotCloseDefault, showDoneEatingSheet, showFinishMealSheet, showLogMealSheet, showMealEditSheet } from './meal.js';
import { showOutsideSheet } from './outside.js';
import { showOpeningSheet, showWindowTimesSheet } from './window-times.js';
import { dayTypeText, header, liveNote, mealInProgress, mealsOfDay, nextWindowLine, note, notices, runningFullness } from './shared.js';

const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

export function signature(ctx) {
  const { mode, rec } = ctx.mode;
  const parts = [mode, ctx.todayKey, minutesOfDay(ctx.nowTs) >= CUTOFF_MIN, !!lateNightDay(ctx)];
  if (mode === 'open') parts.push(windowPhase(rec, ctx.nowTs));
  if (mode === 'closed') parts.push(canReopen(rec, ctx.nowTs));
  parts.push(runningFullness(ctx).length);
  return parts.join('|');
}

export function renderToday(ctx, app) {
  const { mode, rec } = ctx.mode;
  const todayRec = ctx.days.get(ctx.todayKey);
  let main;
  if (mode === 'open') main = openBlock(ctx, app, rec);
  else if (mode === 'forgot') main = forgotBlock(ctx, app, rec);
  else if (mode === 'closed') main = closedBlock(ctx, app, rec);
  else if (mode === 'noEating') main = noEatingBlock(ctx, app);
  else main = beforeBlock(ctx, app);

  // The window on screen may be last night's (open, forgotten, or reopenable after midnight).
  const mealsKey = (mode === 'open' || mode === 'forgot' || mode === 'closed') ? rec.day : ctx.todayKey;
  return h('div', { class: 'today', 'data-mode': mode },
    header(ctx, app, { title: fmtDayLong(ctx.todayKey), sub: dayTypeText(ctx.todayKey, todayRec) }),
    notices(ctx, app),
    main,
    streakSection(ctx),
    checkinSection(ctx, app),
    mealsSection(ctx, app, mealsKey),
    dunes(),
  );
}

// ---------- Before the window ----------

function beforeBlock(ctx, app) {
  const key = ctx.todayKey;
  const rec = ctx.days.get(key);
  const planned = plannedStartMin(key, rec, ctx.settings);
  const workdayEarly = isWorkday(key, rec) && minutesOfDay(ctx.nowTs) < CUTOFF_MIN;
  const last = lastEatingTs(ctx);
  const late = lateNightDay(ctx);
  return h('section', { class: 'section strong', 'data-block': 'before' },
    h('div', { class: 'row' },
      h('div', { class: 'main' },
        h('div', { class: 'label' }, 'Before the window'),
        h('h1', { class: 'display gap-s' }, 'Fasting'),
        h('p', { class: 'gap' }, 'Window planned for ', hl(fmtMinutes(planned)), '.')),
      h('div', { class: 'margin' },
        last ? note('Last bite', fmtWhen(last, key)) : null,
        last ? liveNote('Since', (t) => fmtElapsed(t - last)) : null)),
    workdayEarly ? h('p', { class: 'statement gap', 'data-testid': 'firm-reminder' }, 'Opening before 16:00 makes today a miss.') : null,
    h('div', { class: 'gap-l' }, button('First bite', () => firstBite(app.ctx(), app), { big: true, name: 'first-bite' })),
    h('p', { class: 'quiet small gap' }, 'Until then: water, sparkling water, black coffee, espresso, plain tea.'),
    late
      ? h('div', { class: 'gap' }, button('Eating late? Count it against last night', () => showOutsideSheet(app, { day: late }), { kind: 'secondary', name: 'late-night' }))
      : null,
    isWorkweekday(key) ? dayOffToggle(ctx, key) : null,
  );
}

function dayOffToggle(ctx, key) {
  const rec = ctx.days.get(key);
  const off = !!(rec && rec.dayOff);
  return h('div', { class: 'gap-s' },
    off
      ? h('div', { class: 'btn-row' },
        h('span', { class: 'small quiet' }, 'Day off: weekend rules today.'),
        button('Undo', () => store.updateDay(key, { dayOff: false }), { kind: 'secondary', name: 'day-off-undo' }))
      : button('Mark today as a day off', () => store.updateDay(key, { dayOff: true }), { kind: 'secondary', name: 'day-off' }));
}

// ---------- Window open ----------

function openBlock(ctx, app, rec) {
  const closesAt = rec.firstBite + WINDOW_MS;
  const phase = windowPhase(rec, ctx.nowTs);
  const e = ctx.evaluate(rec.day);
  const eating = mealInProgress(ctx, rec.day);
  const minsLeft = (t, end) => `${Math.max(0, Math.ceil((end - t) / MIN))} min`;
  return h('section', { class: 'section strong', 'data-block': 'open', 'data-phase': phase },
    h('div', { class: 'row' },
      h('div', { class: 'main' }, h('div', { class: 'label' }, 'Window open')),
      h('div', { class: 'margin' },
        note('Opened', fmtWhen(rec.firstBite, ctx.todayKey)),
        note('Closes', fmtTime(closesAt)))),
    h('div', { class: 'gap' },
      live('div', { class: 'countdown', 'data-testid': 'countdown', role: 'timer' }, (t) => fmtCountdown(closesAt - t)),
      h('div', { class: 'label countdown-caption' }, 'left of 4 hours')),
    phase === 'warn'
      ? h('p', { class: 'gap-l', 'data-testid': 'warn-30' }, live('span', { class: 'hl' }, (t) => minsLeft(t, closesAt)), ` left. The window closes at ${fmtTime(closesAt)}.`)
      : null,
    phase === 'grace'
      ? h('p', { class: 'gap-l', 'data-testid': 'grace' }, 'Four hours are up. ', live('span', { class: 'hl' }, (t) => minsLeft(t, rec.firstBite + LIMIT_MS)), ' of grace left.')
      : null,
    phase === 'over'
      ? h('p', { class: 'statement clay gap-l', 'data-testid': 'over' }, live('span', {}, (t) => `Over by ${fmtDuration(t - closesAt)}`))
      : null,
    e.openedEarly ? h('p', { class: 'gap' }, 'Opened before 16:00, so today counts as a miss.') : null,
    eating
      ? h('div', { class: 'gap-l' },
        h('div', { class: 'label' }, 'Eating'),
        h('p', { class: 'gap-s' }, `${eating.name || 'A meal'}, since ${fmtTime(eating.startedAt)}.`),
        h('div', { class: 'gap' }, button('Finished this meal', () => showFinishMealSheet(app, eating.id), { block: true, name: 'finish-meal' })))
      : h('div', { class: 'gap' }, button('Log a meal', () => showLogMealSheet(app, rec.day), { kind: 'secondary', name: 'log-meal' })),
    h('div', { class: 'gap' }, button("I'm done eating", () => showDoneEatingSheet(app, rec.day), { block: true, name: 'done-eating' })),
    h('div', { class: 'gap-s' }, button('Change opening time', () => showOpeningSheet(app, rec.day), { kind: 'secondary', name: 'change-opening' })),
  );
}

// ---------- Forgotten close ----------

// The typed last bite survives re-renders until the window is closed.
let forgotDraft = null;

function forgotBlock(ctx, app, rec) {
  const id = `${rec.day}|${rec.firstBite}`;
  if (!forgotDraft || forgotDraft.id !== id) {
    // Suggest the last logged meal time; with none logged, ask for a real answer.
    const known = forgotCloseDefault(ctx, rec);
    forgotDraft = { id, minutes: known > rec.firstBite ? minutesOfDay(known) : null, hint: '' };
  }
  const draft = forgotDraft;
  const block = h('section', { class: 'section strong', 'data-block': 'forgot' });
  const draw = () => {
    block.replaceChildren(...[
      h('div', { class: 'label' }, 'Window still open'),
      h('p', { class: 'statement gap-s' }, `Your window from ${fmtWhen(rec.firstBite, ctx.todayKey)} is still open.`),
      h('p', { class: 'gap' }, 'When was your last bite?'),
      h('div', { class: 'gap' }, timeField({ minutes: draft.minutes, name: 'forgot-last-bite', onChange: (m) => { draft.minutes = m; } })),
      draft.hint ? h('p', { class: 'quiet small gap-s' }, draft.hint) : null,
      h('div', { class: 'gap-l' }, button('Close the window', async () => {
        if (draft.minutes == null) { draft.hint = 'Enter the time of your last bite, like 21:00.'; draw(); return; }
        const last = timeOnOrAfter(rec.firstBite, draft.minutes);
        if (last > now()) { draft.hint = 'That time is still ahead.'; draw(); return; }
        // Closing also ends any meal left open, at the last bite.
        await store.closeWindow(rec.day, last);
      }, { block: true, name: 'forgot-close' })),
    ].filter(Boolean));
  };
  draw();
  return block;
}

// ---------- Window closed ----------

function reasonLine(reason, e) {
  if (reason === 'over') return `Over by ${fmtDuration(e.overByMs)}.`;
  if (reason === 'early') return `Opened at ${fmtTime(e.firstBite)}, before 16:00.`;
  return 'Ate outside the window.';
}

function closedBlock(ctx, app, rec) {
  const e = ctx.evaluate(rec.day);
  const success = e.result === 'success';
  const reopen = canReopen(rec, ctx.nowTs);
  return h('section', { class: 'section strong', 'data-block': 'closed', 'data-result': e.result },
    h('div', { class: 'row' },
      h('div', { class: 'main' },
        h('div', { class: 'label' }, 'Window closed'),
        h('h1', { class: `display gap-s ${success ? 'hl' : 'clay'}`, 'data-testid': 'window-length' }, fmtDuration(e.lengthMs))),
      h('div', { class: 'margin' },
        note('First bite', fmtTime(rec.firstBite)),
        note('Last bite', fmtWhen(rec.lastBite, ctx.todayKey)),
        liveNote('Since', (t) => fmtElapsed(t - (lastEatingTs(ctx) || rec.lastBite))))),
    success
      ? h('p', { class: 'statement gap', 'data-testid': 'result' }, 'Success. All eating inside the window.')
      : h('div', { class: 'gap', 'data-testid': 'result' }, e.reasons.map((r) => h('p', { class: 'statement clay' }, reasonLine(r, e)))),
    reopen
      ? h('div', { class: 'btn-row gap' },
        h('span', { class: 'small quiet' }, 'Still inside your 4 hours.'),
        button('Reopen window', () => store.reopenWindow(rec.day), { kind: 'secondary', name: 'reopen' }))
      : null,
    h('div', { class: 'btn-row gap' },
      button('I ate something', () => showOutsideSheet(app, { day: rec.day }), { kind: 'secondary', name: 'ate-something' }),
      button('Change times', () => showWindowTimesSheet(app, rec.day), { kind: 'secondary', name: 'change-times' })),
    h('p', { class: 'quiet gap', 'data-testid': 'next-window' }, nextWindowLine(ctx, rec.day)),
  );
}

function noEatingBlock(ctx, app) {
  return h('section', { class: 'section strong', 'data-block': 'no-eating' },
    h('div', { class: 'label' }, 'No eating today'),
    h('p', { class: 'statement gap-s' }, 'Logged as a day without eating.'),
    h('div', { class: 'gap' }, button('Undo', () => store.setNoEating(ctx.todayKey, false), { kind: 'secondary', name: 'undo-no-eating' })));
}

// ---------- Streak ----------

function streakSection(ctx) {
  return h('section', { class: 'section', 'data-block': 'streak' },
    h('div', { class: 'row' },
      h('div', { class: 'main' },
        h('div', { class: 'label' }, 'Streak'),
        h('div', { class: 'figure gap-s', 'data-testid': 'streak' }, days(ctx.streak.current))),
      h('div', { class: 'margin' }, note('Best', days(ctx.streak.best)))));
}

// ---------- Check-ins ----------

function checkinSection(ctx, app) {
  const key = ctx.todayKey;
  const rec = ctx.days.get(key) || {};
  const workday = isWorkday(key, rec);
  const after4 = minutesOfDay(ctx.nowTs) >= CUTOFF_MIN;
  return h('section', { class: 'section', 'data-block': 'checkin' },
    h('div', { class: 'label' }, 'Check-in'),
    workday
      ? (after4
        ? h('div', { class: 'gap' }, scale({ n: 5, value: rec.energy4pm ?? null, label: 'Energy at 4 PM', low: '1 drained', high: '5 sharp', name: 'energy',
          onChange: (v) => store.updateDay(key, { energy4pm: v }) }))
        : h('p', { class: 'quiet small gap-s' }, 'Energy at 4 PM: rate it here from 16:00.'))
      : null,
    h('div', { class: 'gap' },
      choice({ label: 'Trained today', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }], value: rec.trained ?? null, cols: 2, name: 'trained',
        onChange: (v) => store.updateDay(key, { trained: v, trainingType: v ? rec.trainingType || null : null }) })),
    rec.trained
      ? h('div', { class: 'gap' },
        choice({ label: 'Type', options: TRAINING_OPTIONS, value: rec.trainingType || null, cols: 3, name: 'training-type',
          onChange: (v) => store.updateDay(key, { trainingType: v }) }))
      : null,
  );
}

// ---------- Meals ----------

function mealsSection(ctx, app, key) {
  const meals = mealsOfDay(ctx, key);
  if (!meals.length) return null;
  const running = runningFullness(ctx).filter((m) => m.day === key);
  return h('section', { class: 'section', 'data-block': 'meals' },
    h('div', { class: 'row' },
      h('div', { class: 'main' }, h('div', { class: 'label' }, 'Meals')),
      h('div', { class: 'margin' },
        running.map((m) => liveNote('Fullness check', (t) => (m.fullness20DueAt > t ? `in ${fmtDuration(m.fullness20DueAt - t)}` : 'now'))))),
    h('ul', { class: 'list gap-s' }, meals.map((m) => h('li', {},
      h('button', { type: 'button', class: 'item', 'data-meal': String(m.id), onclick: () => showMealEditSheet(app, m.id) },
        h('span', {},
          h('span', { class: 'item-title' }, m.name || 'Meal'),
          mealMeta(m) ? [h('br'), h('span', { class: 'item-meta' }, mealMeta(m))] : null),
        h('span', { class: 'item-side' }, m.finishedAt ? `${fmtTime(m.startedAt)} to ${fmtTime(m.finishedAt)}` : `from ${fmtTime(m.startedAt)}`))))),
  );
}

export function mealMeta(m) {
  const bits = [];
  if (m.hungerBefore != null) bits.push(`hunger ${m.hungerBefore}`);
  if (m.stop) bits.push(`stopped ${STOP_TEXT[m.stop]}`);
  if (m.fullnessNow != null) bits.push(`fullness ${m.fullnessNow}`);
  if (m.fullness20 != null) bits.push(`at 20 min ${m.fullness20}`);
  return bits.length ? bits.join(', ') : '';
}
