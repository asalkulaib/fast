// Today: the eating window.

import { h, hl, live } from './dom.js';
import { button, choice, scale, timeField, TRAINING_OPTIONS, STOP_TEXT } from './components.js';
import * as store from '../store.js';
import {
  HOUR, MIN, addDays, fmtCountdown, fmtDayLong, fmtDayShort, fmtDuration, fmtMinutes, fmtTime, fmtWhen, isWorkweekday, minutesOfDay, now,
} from '../core/time.js';
import {
  CUTOFF_MIN, GRACE_MS, canReopen, goalLabel, isWorkday, lastEatingSource, lastEatingTs, lateNightDay, plannedStartMin, timeOnOrAfter, windowPhase,
} from '../core/rules.js';
import { dunes } from './art.js';
import { forgotCloseDefault, showDoneEatingSheet, showFinishMealSheet, showMealEditSheet, showStartMealSheet } from './meal.js';
import { showOutsideSheet } from './outside.js';
import { showBiteTimeSheet, showOpeningSheet, showOutsideTimeSheet, showWindowTimesSheet } from './window-times.js';
import { ringHero, stagesSection } from './stages.js';
import { currentPause, endPause, pauseToday, showPauseSheet } from './pause.js';
import { showBeginFastSheet } from './begin-fast.js';
import { showGoalSheet } from './goal.js';
import { climbSection } from './climb.js';
import { fullnessCard } from './fullness.js';
import { dayTypeText, header, liveNote, mealInProgress, mealsOfDay, nextWindowLine, note, notices, runningFullness, tapNote } from './shared.js';

const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
const hoursWord = (ms) => { const n = Math.round(ms / HOUR); return `${n} ${n === 1 ? 'hour' : 'hours'}`; };

export function signature(ctx) {
  const { mode, rec } = ctx.mode;
  const parts = [mode, ctx.todayKey, minutesOfDay(ctx.nowTs) >= CUTOFF_MIN, !!lateNightDay(ctx)];
  if (mode === 'open') parts.push(windowPhase(rec, ctx.nowTs, ctx.windowMsFor(rec.day)));
  if (mode === 'closed') parts.push(canReopen(rec, ctx.nowTs, ctx.windowMsFor(rec.day)));
  parts.push(runningFullness(ctx).length);
  // While fasting, redraw the ring every 5 minutes; each stage starts on a 5-minute mark.
  const last = fasting(mode) ? lastEatingTs(ctx) : null;
  if (last) parts.push(Math.floor((ctx.nowTs - last) / (5 * MIN)));
  return parts.join('|');
}

const fasting = (mode) => mode === 'before' || mode === 'closed' || mode === 'noEating';

export function renderToday(ctx, app) {
  const { mode, rec } = ctx.mode;
  const todayRec = ctx.days.get(ctx.todayKey);
  let main;
  if (mode === 'open') main = openBlock(ctx, app, rec);
  else if (mode === 'forgot') main = forgotBlock(ctx, app, rec);
  else if (mode === 'closed') main = closedBlock(ctx, app, rec);
  else if (mode === 'noEating') main = noEatingBlock(ctx, app);
  else if (mode === 'paused') main = pausedBlock(ctx, app);
  else main = beforeBlock(ctx, app);

  // The window on screen may be last night's (open, forgotten, or reopenable after midnight).
  const mealsKey = (mode === 'open' || mode === 'forgot' || mode === 'closed') ? rec.day : ctx.todayKey;
  // Before the window the ring leads the main block; after it, it sits below.
  // How the day's eating ended: asked once the window is closed, and on paused days.
  const fullnessKey = mode === 'closed' ? rec.day : mode === 'paused' ? ctx.todayKey : null;
  return h('div', { class: 'today', 'data-mode': mode },
    header(ctx, app, { title: fmtDayLong(ctx.todayKey), sub: dayTypeText(ctx.todayKey, todayRec) }),
    notices(ctx, app),
    main,
    fullnessKey ? fullnessCard(ctx, fullnessKey) : null,
    fasting(mode) ? stagesSection(ctx, app, lastEatingTs(ctx), { withRing: mode !== 'before' }) : null,
    // The climb up Uhud takes the streak's place; with both climbers off, the streak returns.
    climbSection(ctx) || streakSection(ctx),
    // A paused day tracks nothing.
    mode === 'paused' ? null : checkinSection(ctx, app),
    mode === 'paused' ? null : mealsSection(ctx, app, mealsKey),
    dunes(),
  );
}

// ---------- Before the window ----------

function beforeBlock(ctx, app) {
  const key = ctx.todayKey;
  const rec = ctx.days.get(key);
  const planned = plannedStartMin(key, rec, ctx.settings);
  const workdayEarly = isWorkday(key, rec) && minutesOfDay(ctx.nowTs) < CUTOFF_MIN;
  const lastSrc = lastEatingSource(ctx);
  const last = lastSrc ? lastSrc.ts : null;
  const late = lateNightDay(ctx);
  const plannedLine = h('p', { class: 'gap' }, 'Window planned for ', hl(fmtMinutes(planned)), '.');
  const goalNote = tapNote('Goal', goalLabel(ctx.windowMsFor(key)), () => showGoalSheet(app), 'edit-goal');
  // From Begin fast, a start before the last bite on record leads to that bite.
  const beginFast = () => showBeginFastSheet(app, {
    onBite: () => {
      const src = lastEatingSource(app.ctx(), { fastStarts: false });
      if (src) editLastBite(app, src);
    },
  });
  return h('section', { class: 'section strong', 'data-block': 'before' },
    h('div', { class: 'row' },
      h('div', { class: 'main' },
        h('div', { class: 'label' }, 'Before the window'),
        // With a last bite on record the ring leads; before any, a plain title.
        last ? null : h('h1', { class: 'display gap-s' }, 'Fasting'),
        last ? null : plannedLine),
      h('div', { class: 'margin' },
        lastSrc && lastSrc.kind === 'fast'
          ? tapNote('Fast began', fmtWhen(last, key), beginFast, 'edit-fast-start')
          : last ? tapNote('Last bite', fmtWhen(last, key), () => editLastBite(app, lastSrc), 'edit-last-bite') : goalNote)),
    last ? ringHero(ctx, last) : null,
    // Under the ring, the goal sits in the margin beside the planned time.
    last ? h('div', { class: 'row gap' }, h('div', { class: 'main' }, plannedLine), h('div', { class: 'margin' }, goalNote)) : null,
    last ? null : h('p', { class: 'quiet small gap-s', 'data-testid': 'begin-fast-hint' }, 'Already fasting? Tap Begin fast and set when it began, so none of it is lost.'),
    workdayEarly ? h('p', { class: 'statement gap', 'data-testid': 'firm-reminder' }, 'Opening before 16:00 makes today a miss.') : null,
    // Two equal ways in: a meal (the first opens the window), or a fast already under way.
    h('div', { class: 'btn-pair start-actions gap-l' },
      button('Start a meal', () => showStartMealSheet(app), { big: true, block: true, name: 'start-meal' }),
      button('Begin fast', beginFast, { big: true, block: true, name: 'begin-fast' })),
    h('p', { class: 'quiet small gap' }, 'Until then: water, sparkling water, black coffee, espresso, plain tea.'),
    late
      ? h('div', { class: 'gap' }, button('Eating late? Count it against last night', () => showOutsideSheet(app, { day: late }), { kind: 'secondary', name: 'late-night' }))
      : null,
    isWorkweekday(key) ? dayOffToggle(ctx, key) : null,
    h('div', { class: 'gap-s' }, button('Pause today', () => pauseToday(app), { kind: 'secondary', name: 'pause-today' })),
  );
}

// ---------- Paused ----------

/** 'Thu 1 Oct' with its last space unbreakable, so '1 Oct' stays on one line. */
const keepTogether = (text) => text.replace(/ (\S+)$/, '\u00A0$1');

const FOR_REASON = { travel: 'For travel. ', illness: 'For illness. ', ramadan: 'For Ramadan. ' };

function pausedBlock(ctx, app) {
  const run = currentPause(ctx) || { from: ctx.todayKey, to: ctx.todayKey, reason: true };
  const until = run.to;
  return h('section', { class: 'section strong', 'data-block': 'paused' },
    h('div', { class: 'label' }, 'Paused'),
    h('h1', { class: 'display gap-s', 'data-testid': 'paused-until' }, until === ctx.todayKey ? 'Paused today' : `Paused until ${keepTogether(fmtDayShort(until))}`),
    h('p', { class: 'gap' }, `${FOR_REASON[run.reason] || ''}Fasting is not tracked and the fast climber waits; fullness still counts. Tracking resumes on ${fmtDayLong(addDays(until, 1))}.`),
    h('div', { class: 'btn-row gap' },
      button('End the pause', () => endPause(app, run), { kind: 'secondary', name: 'end-pause' }),
      button('Change', () => showPauseSheet(app, { run }), { kind: 'secondary', name: 'change-pause' })),
  );
}

/** Opens the time of whatever was eaten last: a window's last bite, or an entry outside it. */
function editLastBite(app, src) {
  if (src.kind === 'window') return showBiteTimeSheet(app, src.day, 'last');
  if (src.kind === 'outside') return showOutsideTimeSheet(app, src.id);
  if (src.kind === 'meal') return showMealEditSheet(app, src.id);
  return showOpeningSheet(app, src.day);
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
  const windowMs = ctx.windowMsFor(rec.day);
  const closesAt = rec.firstBite + windowMs;
  const phase = windowPhase(rec, ctx.nowTs, windowMs);
  const e = ctx.evaluate(rec.day);
  const eating = mealInProgress(ctx, rec.day);
  const minsLeft = (t, end) => `${Math.max(0, Math.ceil((end - t) / MIN))} min`;
  return h('section', { class: 'section strong', 'data-block': 'open', 'data-phase': phase },
    h('div', { class: 'row' },
      h('div', { class: 'main' }, h('div', { class: 'label' }, 'Window open')),
      h('div', { class: 'margin' },
        tapNote('Opened', fmtWhen(rec.firstBite, ctx.todayKey), () => showOpeningSheet(app, rec.day), 'edit-opened'),
        note('Closes', fmtTime(closesAt)))),
    h('div', { class: 'gap' },
      live('div', { class: 'countdown', 'data-testid': 'countdown', role: 'timer' }, (t) => fmtCountdown(closesAt - t)),
      h('div', { class: 'label countdown-caption' }, `left of ${hoursWord(windowMs)}`)),
    phase === 'warn'
      ? h('p', { class: 'gap-l', 'data-testid': 'warn-30' }, live('span', { class: 'hl' }, (t) => minsLeft(t, closesAt)), ` left. The window closes at ${fmtTime(closesAt)}.`)
      : null,
    phase === 'grace'
      ? h('p', { class: 'gap-l', 'data-testid': 'grace' }, `Your ${hoursWord(windowMs)} are up. `, live('span', { class: 'hl' }, (t) => minsLeft(t, rec.firstBite + windowMs + GRACE_MS)), ' of grace left.')
      : null,
    phase === 'over'
      ? h('p', { class: 'statement clay gap-l', 'data-testid': 'over' }, live('span', {}, (t) => `Over by ${fmtDuration(t - closesAt)}`))
      : null,
    e.openedEarly ? h('p', { class: 'gap' }, 'Opened before 16:00, so today counts as a miss.') : null,
    eating
      ? eatingNow(app, eating, { another: true })
      : h('div', { class: 'gap-l' }, button('Start a meal', () => showStartMealSheet(app), { block: true, name: 'start-meal' })),
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
      h('div', { class: 'gap' }, timeField({
        minutes: draft.minutes,
        fallback: minutesOfDay(rec.firstBite + ctx.windowMsFor(rec.day)),
        hint: draft.minutes == null ? 'Roll to your last bite.' : '',
        name: 'forgot-last-bite',
        onChange: (m) => { draft.minutes = m; },
      })),
      draft.hint ? h('p', { class: 'quiet small gap-s' }, draft.hint) : null,
      h('div', { class: 'gap-l' }, button('Close the window', async () => {
        if (draft.minutes == null) { draft.hint = 'Roll the wheel to the time of your last bite.'; draw(); return; }
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

/** The meal being eaten, with its Finished button (and Start another meal while the window is open). */
function eatingNow(app, meal, { another = false } = {}) {
  return h('div', { class: 'gap-l', 'data-block': 'eating' },
    h('div', { class: 'label' }, meal.outside ? 'Eating, outside the window' : 'Eating'),
    h('p', { class: 'gap-s' }, `${meal.name || 'A meal'}, since ${fmtTime(meal.startedAt)}.`),
    h('div', { class: 'gap' }, button('Finished this meal', () => showFinishMealSheet(app, meal.id), { block: true, name: 'finish-meal' })),
    another ? h('div', { class: 'gap-s' }, button('Start another meal', () => showStartMealSheet(app), { kind: 'secondary', name: 'another-meal' })) : null);
}

function closedBlock(ctx, app, rec) {
  const e = ctx.evaluate(rec.day);
  const success = e.result === 'success';
  const reopen = canReopen(rec, ctx.nowTs, ctx.windowMsFor(rec.day));
  // A meal started after the window closed, still being eaten.
  const eating = mealInProgress(ctx, rec.day);
  return h('section', { class: 'section strong', 'data-block': 'closed', 'data-result': e.result },
    h('div', { class: 'row' },
      h('div', { class: 'main' },
        h('div', { class: 'label' }, 'Window closed'),
        h('h1', { class: `display gap-s ${success ? 'hl' : 'clay'}`, 'data-testid': 'window-length' }, fmtDuration(e.lengthMs))),
      h('div', { class: 'margin' },
        tapNote('First bite', fmtTime(rec.firstBite), () => showBiteTimeSheet(app, rec.day, 'first'), 'edit-first-bite'),
        tapNote('Last bite', fmtWhen(rec.lastBite, ctx.todayKey), () => showBiteTimeSheet(app, rec.day, 'last'), 'edit-last-bite'))),
    success
      ? h('p', { class: 'statement gap', 'data-testid': 'result' }, 'Success. All eating inside the window.')
      : h('div', { class: 'gap', 'data-testid': 'result' }, e.reasons.map((r) => h('p', { class: 'statement clay' }, reasonLine(r, e)))),
    eating ? eatingNow(app, eating) : null,
    reopen
      ? h('div', { class: 'btn-row gap' },
        h('span', { class: 'small quiet' }, 'Still inside your window.'),
        button('Reopen window', () => store.reopenWindow(rec.day), { kind: 'secondary', name: 'reopen' }))
      : null,
    h('div', { class: 'btn-row gap' },
      eating ? null : button('Start a meal', () => showStartMealSheet(app), { kind: 'secondary', name: 'start-meal' }),
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
  if (m.outside) bits.push('outside the window');
  if (m.hungerBefore != null) bits.push(`hunger ${m.hungerBefore}`);
  if (m.stop) bits.push(STOP_TEXT[m.stop]);
  if (m.fullnessNow != null) bits.push(`fullness ${m.fullnessNow}`);
  if (m.fullness20 != null) bits.push(`at 20 min ${m.fullness20}`);
  return bits.length ? bits.join(', ') : '';
}
