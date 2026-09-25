// Meals: first bite, logging, finishing, closing the window, 20-minute check.

import { h } from './dom.js';
import { button, choice, scale, textField, timeField, STOP_OPTIONS } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import * as store from '../store.js';
import { MIN, HOUR, DAY, dayKey, dayStart, fmtDuration, fmtTime, minutesOfDay, nearestTime, now } from '../core/time.js';
import { CUTOFF_MIN, LATE_NIGHT_END_MIN, isWorkday, timeOnOrAfter } from '../core/rules.js';
import { mealInProgress } from './shared.js';

/** Most recent moment at or before ref with this clock time (for edits after the fact). */
export function latestAtOrBefore(minutes, ref) {
  const ts = dayStart(dayKey(ref)) + minutes * MIN;
  return ts > ref ? ts - DAY : ts;
}

/**
 * A corrected first-bite time lands on the window's own day. A time still
 * ahead is refused, except just after midnight, when a late clock time
 * means last night.
 */
export function resolveFirstBite(key, minutes) {
  const t = now();
  const ts = dayStart(key) + minutes * MIN;
  if (ts <= t + MIN) return ts;
  const prev = ts - DAY;
  if (minutesOfDay(t) < LATE_NIGHT_END_MIN && t - prev < 6 * HOUR) return prev;
  return null;
}

function recentNames(ctx) {
  const counts = new Map();
  for (const m of ctx.meals) if (m.name) counts.set(m.name, (counts.get(m.name) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
}

function nameSection(ctx, draft, api) {
  const names = recentNames(ctx);
  return h('section', { class: 'section' },
    textField({ label: 'Meal', placeholder: 'Dinner', value: draft.name, onInput: (v) => { draft.name = v; }, name: 'meal-name' }),
    names.length
      ? h('div', { class: 'btn-row gap-s' }, names.map((n) => button(n, () => { draft.name = n; api.rerender(); }, { kind: 'secondary' })))
      : null);
}

const hungerScale = (draft) => scale({
  n: 10, value: draft.hungerBefore, onChange: (v) => { draft.hungerBefore = v; },
  label: 'Hunger before', low: '1 not hungry', high: '10 very hungry', name: 'hunger',
});

const stopChoice = (draft) => choice({
  options: STOP_OPTIONS, value: draft.stop, onChange: (v) => { draft.stop = v; },
  label: 'How did you stop?', cols: 3, name: 'stop',
});

const fullnessScale = (draft, key = 'fullnessNow', label = 'Fullness now') => scale({
  n: 10, value: draft[key], onChange: (v) => { draft[key] = v; },
  label, low: '1 empty', high: '10 stuffed', name: key === 'fullnessNow' ? 'fullness-now' : 'fullness-20',
});

// ---------- First bite ----------

/** The First bite button. On a workday before 16:00 it asks first. */
export function firstBite(ctx, app) {
  const key = ctx.todayKey;
  if (isWorkday(key, ctx.days.get(key)) && minutesOfDay(ctx.nowTs) < CUTOFF_MIN) {
    openSheet((api) => h('div', {},
      sheetHead(api, 'First bite'),
      h('p', { class: 'statement' }, 'Open the window now?'),
      h('p', { class: 'gap' }, 'Today is a workday and it is before 16:00, so today will count as a miss.'),
      h('div', { class: 'stack gap-l' },
        button('Open the window', () => openWindowNow(app), { block: true, name: 'confirm-open' }),
        button('Not yet', () => api.close(), { kind: 'secondary', name: 'not-yet' }))),
    { name: 'confirm-open', label: 'Open the window' });
    return;
  }
  openWindowNow(app);
}

/** Opens the window at this minute and shows the first-bite reminder. */
export async function openWindowNow(app) {
  const rec = await store.openWindow(now());
  showFirstBiteSheet(app, rec.day);
  return rec;
}

export function showFirstBiteSheet(app, initialKey) {
  let key = initialKey;
  const draft = { name: '', hungerBefore: null };
  let hint = '';
  openSheet((api) => {
    const ctx = app.ctx();
    const rec = ctx.days.get(key);
    if (!rec || !rec.firstBite) return h('div', {}, sheetHead(api, 'First bite'), h('p', {}, 'No window is open.'));
    return h('div', {},
      sheetHead(api, 'First bite'),
      h('div', { class: 'stanza' },
        h('p', { class: 'statement' }, 'Protein and vegetables first.'),
        h('p', { class: 'statement' }, 'Eat slowly.'),
        h('p', { class: 'statement' }, 'Pause halfway.')),
      h('section', { class: 'section gap-l' },
        timeField({
          label: 'First bite at',
          minutes: minutesOfDay(rec.firstBite),
          name: 'first-bite',
          hint,
          onChange: async (m) => {
            const ts = resolveFirstBite(key, m);
            if (ts == null) {
              hint = 'That time is still ahead.';
            } else {
              const moved = await store.moveFirstBite(key, ts);
              if (moved.error) hint = moved.error;
              else { key = moved.key; hint = ''; }
            }
            api.rerender();
          },
        })),
      nameSection(ctx, draft, api),
      h('section', { class: 'section' }, hungerScale(draft)),
      h('div', { class: 'gap' }, button('Start eating', async () => {
        const r = store.state.days.get(key);
        await store.startMeal({ day: key, name: draft.name, startedAt: r.firstBite, hungerBefore: draft.hungerBefore });
        api.close();
      }, { block: true, name: 'start-eating' })),
      h('div', { class: 'gap-s' }, button('Opened by mistake? Undo', async () => {
        await store.undoOpen(key);
        api.close();
      }, { kind: 'secondary', name: 'undo-open' })),
    );
  }, { name: 'first-bite', label: 'First bite' });
}

// ---------- Log a meal ----------

export function showLogMealSheet(app, key) {
  // Only an open window takes a meal that is still being eaten. For a closed
  // window or a past day, the meal is logged complete, starting at its window.
  const rec0 = app.ctx().days.get(key);
  const open = !!(rec0 && rec0.firstBite && !rec0.lastBite);
  const startDefault = open || !rec0 || !rec0.firstBite ? minutesOfDay(now()) : minutesOfDay(rec0.firstBite);
  const finishDefault = !open && rec0 && rec0.lastBite ? minutesOfDay(rec0.lastBite) : minutesOfDay(now());
  const draft = { name: '', minutes: startDefault, hungerBefore: null, done: !open, stop: null, fullnessNow: null, finishMinutes: finishDefault };
  let hint = '';
  openSheet((api) => {
    const ctx = app.ctx();
    const rec = ctx.days.get(key);
    const base = rec && rec.firstBite ? rec.firstBite : dayStart(key);
    const startedAt = () => timeOnOrAfter(base, draft.minutes);
    return h('div', {},
      sheetHead(api, 'Log a meal'),
      nameSection(ctx, draft, api),
      h('section', { class: 'section' },
        timeField({ label: 'Started at', minutes: draft.minutes, name: 'meal-start', onChange: (m) => { draft.minutes = m; } })),
      h('section', { class: 'section' }, hungerScale(draft)),
      draft.done
        ? [
          h('section', { class: 'section' }, stopChoice(draft)),
          h('section', { class: 'section' }, fullnessScale(draft)),
          h('section', { class: 'section' },
            timeField({ label: 'Finished at', minutes: draft.finishMinutes, name: 'meal-finish', onChange: (m) => { draft.finishMinutes = m; } })),
        ]
        : null,
      hint ? h('p', { class: 'quiet small' }, hint) : null,
      h('div', { class: 'gap' }, button(draft.done ? 'Save meal' : 'Start eating', async () => {
        const start = startedAt();
        if (start > now() + MIN) { hint = 'That start time is still ahead.'; api.rerender(); return; }
        const meal = await store.startMeal({ day: key, name: draft.name, startedAt: start, hungerBefore: draft.hungerBefore });
        if (draft.done) {
          const finishedAt = Math.min(timeOnOrAfter(start, draft.finishMinutes), now());
          await store.finishMeal(meal.id, { finishedAt, stop: draft.stop, fullnessNow: draft.fullnessNow });
        }
        api.close();
      }, { block: true, name: draft.done ? 'save-meal' : 'start-eating' })),
      draft.done || !open ? null : h('div', { class: 'gap-s' }, button('Already finished? Log it all at once', () => { draft.done = true; api.rerender(); }, { kind: 'secondary', name: 'already-finished' })),
    );
  }, { name: 'log-meal', label: 'Log a meal' });
}

// ---------- Finish a meal ----------

export function showFinishMealSheet(app, mealId) {
  const draft = { stop: null, fullnessNow: null, minutes: minutesOfDay(now()) };
  openSheet((api) => {
    const meal = store.state.meals.get(mealId);
    if (!meal) return h('div', {}, sheetHead(api, 'Finished'), h('p', {}, 'This meal was removed.'));
    return h('div', {},
      sheetHead(api, 'Finished this meal'),
      h('h2', { class: 'h2' }, meal.name || 'This meal'),
      h('section', { class: 'section gap' }, stopChoice(draft)),
      h('section', { class: 'section' }, fullnessScale(draft)),
      h('section', { class: 'section' },
        timeField({ label: 'Finished at', minutes: draft.minutes, name: 'finished-at', onChange: (m) => { draft.minutes = m; } })),
      h('div', { class: 'gap' }, button('Save', async () => {
        const finishedAt = Math.min(timeOnOrAfter(meal.startedAt, draft.minutes), now());
        await store.finishMeal(mealId, { finishedAt, stop: draft.stop, fullnessNow: draft.fullnessNow });
        await api.close();
        app.flash(`Fullness check at ${fmtTime(finishedAt + store.FULLNESS_DELAY)}.`);
      }, { block: true, name: 'save-finish' })),
    );
  }, { name: 'finish-meal', label: 'Finished this meal' });
}

// ---------- I'm done eating ----------

export function showDoneEatingSheet(app, windowKey) {
  const ctx0 = app.ctx();
  const open = mealInProgress(ctx0, windowKey);
  const draft = { minutes: minutesOfDay(now()), stop: null, fullnessNow: null };
  openSheet((api) => {
    const rec = store.state.days.get(windowKey);
    if (!rec || !rec.firstBite) return h('div', {}, sheetHead(api, "I'm done eating"), h('p', {}, 'No window is open.'));
    const lastBite = timeOnOrAfter(rec.firstBite, draft.minutes);
    const future = lastBite > now() + MIN;
    return h('div', {},
      sheetHead(api, "I'm done eating"),
      open
        ? h('div', {},
          h('h2', { class: 'h2' }, `Finish ${open.name || 'this meal'}`),
          h('section', { class: 'section gap' }, stopChoice(draft)),
          h('section', { class: 'section' }, fullnessScale(draft)))
        : null,
      h('section', { class: 'section' },
        timeField({ label: 'Last bite at', minutes: draft.minutes, name: 'last-bite', onChange: (m) => { draft.minutes = m; api.rerender(); } }),
        h('p', { class: 'quiet small gap-s' },
          future ? 'That time is still ahead.' : `Window ${fmtTime(rec.firstBite)} to ${fmtTime(lastBite)}, ${fmtDuration(lastBite - rec.firstBite)}.`)),
      h('div', { class: 'gap' }, button('Close the window', async () => {
        if (future) return;
        if (open) await store.finishMeal(open.id, { finishedAt: Math.max(lastBite, open.startedAt), stop: draft.stop, fullnessNow: draft.fullnessNow });
        await store.closeWindow(windowKey, lastBite);
        api.close();
      }, { block: true, name: 'close-window', disabled: future })),
    );
  }, { name: 'done-eating', label: "I'm done eating" });
}

/** Forgotten close: asks for the last bite of a window left open. */
export function forgotCloseDefault(ctx, rec) {
  let last = rec.firstBite;
  for (const m of ctx.meals) if (m.day === rec.day) last = Math.max(last, m.finishedAt || m.startedAt);
  return last;
}

// ---------- 20-minute fullness ----------

export function showFullnessSheet(app, mealId) {
  const draft = { fullness20: null };
  let hint = '';
  openSheet((api) => {
    const meal = store.state.meals.get(mealId);
    if (!meal) return h('div', {}, sheetHead(api, 'Fullness check'), h('p', {}, 'This meal was removed.'));
    return h('div', {},
      sheetHead(api, 'Fullness check', 'Later'),
      h('h2', { class: 'h2' }, `20 minutes after ${meal.name || 'your meal'}`),
      h('p', { class: 'quiet gap-s' }, meal.fullnessNow != null ? `Right after eating: ${meal.fullnessNow}. Target about 7.` : 'Target about 7.'),
      h('section', { class: 'section gap' }, fullnessScale(draft, 'fullness20', 'Fullness now')),
      hint ? h('p', { class: 'quiet small' }, hint) : null,
      h('div', { class: 'gap' }, button('Save', async () => {
        if (draft.fullness20 == null) { hint = 'Pick a number from 1 to 10.'; api.rerender(); return; }
        await store.updateMeal(mealId, { fullness20: draft.fullness20, fullness20At: now() });
        api.close();
      }, { block: true, name: 'save-fullness' })),
      h('div', { class: 'gap-s' }, button('Skip this one', async () => {
        await store.updateMeal(mealId, { fullness20Skipped: true });
        api.close();
      }, { kind: 'secondary', name: 'skip-fullness' })),
    );
  }, { name: 'fullness', label: 'Fullness check' });
}

// ---------- Edit a meal ----------

export function showMealEditSheet(app, mealId) {
  const original = store.state.meals.get(mealId);
  if (!original) return;
  const draft = { ...original, minutes: minutesOfDay(original.startedAt), finishMinutes: original.finishedAt ? minutesOfDay(original.finishedAt) : null };
  let confirming = false;
  openSheet((api) => {
    const ctx = app.ctx();
    return h('div', {},
      sheetHead(api, 'Meal'),
      nameSection(ctx, draft, api),
      h('section', { class: 'section' },
        h('div', { class: 'btn-pair' },
          timeField({ label: 'Started', minutes: draft.minutes, name: 'edit-start', onChange: (m) => { draft.minutes = m; } }),
          timeField({ label: 'Finished', minutes: draft.finishMinutes, name: 'edit-finish', onChange: (m) => { draft.finishMinutes = m; } }))),
      h('section', { class: 'section' }, hungerScale(draft)),
      h('section', { class: 'section' }, stopChoice(draft)),
      h('section', { class: 'section' }, fullnessScale(draft)),
      h('section', { class: 'section' }, fullnessScale(draft, 'fullness20', 'Fullness at 20 minutes')),
      h('div', { class: 'gap' }, button('Save', async () => {
        // Unchanged times keep their exact moment; a changed time stays next to the old one.
        const startedAt = draft.minutes === minutesOfDay(original.startedAt)
          ? original.startedAt
          : nearestTime(original.startedAt, draft.minutes);
        let finishedAt = null;
        if (draft.finishMinutes != null) {
          if (original.finishedAt && draft.finishMinutes === minutesOfDay(original.finishedAt)) finishedAt = original.finishedAt;
          else finishedAt = timeOnOrAfter(startedAt, draft.finishMinutes);
        }
        const sameFinish = finishedAt === original.finishedAt;
        await store.updateMeal(mealId, {
          name: draft.name || '',
          startedAt,
          finishedAt,
          hungerBefore: draft.hungerBefore ?? null,
          stop: draft.stop ?? null,
          fullnessNow: draft.fullnessNow ?? null,
          fullness20: draft.fullness20 ?? null,
          fullness20DueAt: sameFinish ? original.fullness20DueAt ?? null : finishedAt ? store.fullnessDueAt(finishedAt) : null,
        });
        api.close();
      }, { block: true, name: 'save-meal-edit' })),
      h('div', { class: 'gap-s' }, confirming
        ? h('div', { class: 'btn-row' },
          h('span', { class: 'small' }, 'Delete this meal?'),
          button('Delete', async () => { await store.deleteMeal(mealId); api.close(); }, { kind: 'secondary', name: 'confirm-delete-meal' }),
          button('Keep', () => { confirming = false; api.rerender(); }, { kind: 'secondary' }))
        : button('Delete meal', () => { confirming = true; api.rerender(); }, { kind: 'secondary', name: 'delete-meal' })),
    );
  }, { name: 'edit-meal', label: 'Meal' });
}
