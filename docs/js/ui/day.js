// One day, for filling in and correcting: window times, meals, eating
// outside the window, check-ins and temptations.

import { h, hl } from './dom.js';
import { button, choice, scale, timeField, TRAINING_OPTIONS, TRIGGER_OPTIONS, OUTCOME_TEXT } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import * as store from '../store.js';
import { at, fmtDayLong, fmtDuration, fmtTime, fmtWhen, isWorkweekday, minutesOfDay, nearestTime, now, weekStart } from '../core/time.js';
import { isWorkday, timeOnOrAfter } from '../core/rules.js';
import { showLogMealSheet, showMealEditSheet } from './meal.js';
import { AMOUNT_OPTIONS, showOutsideSheet } from './outside.js';
import { mealMeta } from './today.js';
import { dayTypeText, header, mealsOfDay, outsideOfDay, temptationsOfDay } from './shared.js';

const REASON = { early: 'opened before 16:00', over: 'over 4 h 15 min', outside: 'ate outside the window' };

function resultLine(e) {
  switch (e.result) {
    case 'success': return h('p', { class: 'gap-s' }, hl(e.state === 'noEating' ? 'Success: no eating.' : 'Success.'));
    case 'miss': return h('p', { class: 'gap-s' }, `Miss: ${e.reasons.map((r) => REASON[r]).join(', ')}.`);
    case 'pending': return h('p', { class: 'gap-s quiet' }, e.state === 'open' ? 'Window open.' : 'In progress.');
    case 'unlogged': return h('p', { class: 'gap-s quiet' }, 'Nothing logged yet.');
    default: return h('p', { class: 'gap-s quiet' }, 'Before tracking started.');
  }
}

export function renderDay(ctx, app, key) {
  const rec = ctx.days.get(key) || { day: key };
  const e = ctx.evaluate(key);
  const past = key <= ctx.todayKey;
  return h('div', { class: 'day', 'data-day': key },
    header(ctx, app, { title: 'Day', sub: dayTypeText(key, rec) }),
    h('section', { class: 'section strong' },
      h('h1', { class: 'display' }, fmtDayLong(key)),
      resultLine(e),
      button('‹ Back to the week', () => app.go(`week/${weekStart(key)}`), { kind: 'secondary', name: 'back-to-week' })),
    past ? windowSection(ctx, app, key, rec) : h('section', { class: 'section' }, h('p', { class: 'quiet' }, 'This day has not started yet.')),
    isWorkweekday(key) ? h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Day off'),
      h('p', { class: 'small gap-s' }, rec.dayOff ? 'Weekend rules apply to this day.' : 'A workday: the 16:00 rule applies.'),
      button(rec.dayOff ? 'Make it a workday again' : 'Mark as a day off', () => store.updateDay(key, { dayOff: !rec.dayOff }), { kind: 'secondary', name: 'toggle-day-off' })) : null,
    past ? mealsSection(ctx, app, key, rec) : null,
    past ? outsideSection(ctx, app, key) : null,
    past ? checkinSection(ctx, key, rec) : null,
    past ? temptationSection(ctx, app, key) : null,
  );
}

// Unsaved window times survive re-renders (for example after rating energy
// further down the same screen) until the saved record itself changes.
const windowDrafts = new Map();

function windowSection(ctx, app, key, rec) {
  const section = h('section', { class: 'section', 'data-block': 'day-window' });
  const fingerprint = `${rec.firstBite}|${rec.lastBite}|${rec.noEating}`;
  let draft = windowDrafts.get(key);
  if (!draft || draft.fingerprint !== fingerprint) {
    draft = {
      fingerprint,
      first: rec.firstBite ? minutesOfDay(rec.firstBite) : null,
      last: rec.lastBite ? minutesOfDay(rec.lastBite) : null,
      editing: !!rec.firstBite,
      confirmClear: false,
      hint: '',
    };
    windowDrafts.set(key, draft);
  }
  const draw = () => {
    const children = [h('div', { class: 'label' }, 'Window')];
    if (!draft.editing) {
      if (rec.noEating) {
        children.push(h('p', { class: 'gap-s' }, 'No eating this day.'),
          button('Undo', () => store.setNoEating(key, false), { kind: 'secondary', name: 'undo-no-eating' }));
      } else {
        children.push(h('p', { class: 'gap-s quiet' }, 'No window logged.'),
          h('div', { class: 'btn-row' },
            button("Log this day's window", () => { draft.editing = true; draw(); }, { kind: 'secondary', name: 'log-window' }),
            button('No eating this day', () => store.setNoEating(key, true), { kind: 'secondary', name: 'no-eating' })));
      }
    } else {
      const firstTs = draft.first != null ? at(key, draft.first) : null;
      const lastTs = firstTs != null && draft.last != null ? timeOnOrAfter(firstTs, draft.last) : null;
      children.push(
        h('div', { class: 'btn-pair gap-s' },
          timeField({ label: 'First bite', minutes: draft.first, name: 'day-first', onChange: (m) => { draft.first = m; draw(); } }),
          timeField({ label: 'Last bite', minutes: draft.last, name: 'day-last', hint: draft.last == null ? 'open' : '', onChange: (m) => { draft.last = m; draw(); } })),
        h('p', { class: 'quiet small gap-s' }, lastTs != null ? `${fmtTime(firstTs)} to ${fmtWhen(lastTs, key)}, ${fmtDuration(lastTs - firstTs)}.` : 'Leave the last bite empty while the window is open.'),
        draft.hint ? h('p', { class: 'small' }, draft.hint) : null,
        h('div', { class: 'gap' }, button('Save window', async () => {
          if (firstTs == null) { draft.hint = 'Add the first bite time.'; draw(); return; }
          if (firstTs > now() || (lastTs != null && lastTs > now())) { draft.hint = 'That time is still ahead.'; draw(); return; }
          await store.setWindowTimes(key, firstTs, lastTs);
        }, { block: true, name: 'save-window' })),
        rec.firstBite
          ? h('div', { class: 'gap-s' }, draft.confirmClear
            ? h('div', { class: 'btn-row' }, h('span', { class: 'small' }, 'Clear this window?'),
              button('Clear', () => store.clearWindow(key), { kind: 'secondary', name: 'confirm-clear' }),
              button('Keep', () => { draft.confirmClear = false; draw(); }, { kind: 'secondary' }))
            : button('Clear this window', () => { draft.confirmClear = true; draw(); }, { kind: 'secondary', name: 'clear-window' }))
          : null,
      );
    }
    section.replaceChildren(...children.filter(Boolean));
  };
  draw();
  return section;
}

function mealsSection(ctx, app, key, rec) {
  const meals = mealsOfDay(ctx, key);
  return h('section', { class: 'section', 'data-block': 'day-meals' },
    h('div', { class: 'label' }, 'Meals'),
    meals.length
      ? h('ul', { class: 'list gap-s' }, meals.map((m) => h('li', {},
        h('button', { type: 'button', class: 'item', 'data-meal': String(m.id), onclick: () => showMealEditSheet(app, m.id) },
          h('span', {}, h('span', { class: 'item-title' }, m.name || 'Meal'), h('br'), h('span', { class: 'item-meta' }, mealMeta(m))),
          h('span', { class: 'item-side' }, m.finishedAt ? `${fmtTime(m.startedAt)} to ${fmtTime(m.finishedAt)}` : fmtTime(m.startedAt))))))
      : h('p', { class: 'quiet small gap-s' }, 'No meals logged.'),
    rec.firstBite ? button('Add a meal', () => showLogMealSheet(app, key), { kind: 'secondary', name: 'add-meal' }) : null);
}

function outsideSection(ctx, app, key) {
  const items = outsideOfDay(ctx, key);
  const trig = Object.fromEntries(TRIGGER_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]));
  return h('section', { class: 'section', 'data-block': 'day-outside' },
    h('div', { class: 'label' }, 'Outside the window'),
    items.length
      ? h('ul', { class: 'list gap-s' }, items.map((o) => h('li', {},
        h('button', { type: 'button', class: 'item', 'data-outside': String(o.id), onclick: () => showOutsideEditSheet(app, o.id) },
          h('span', {}, `${trig[o.trigger] || 'no trigger'}${o.amount === 'little' ? ', a little' : o.amount === 'meal' ? ', more than a little' : ''}`),
          h('span', { class: 'item-side' }, fmtWhen(o.at, key))))))
      : h('p', { class: 'quiet small gap-s' }, 'Nothing outside the window.'),
    button('Add eating outside the window', () => showOutsideSheet(app, { day: key }), { kind: 'secondary', name: 'add-outside' }));
}

function checkinSection(ctx, key, rec) {
  return h('section', { class: 'section', 'data-block': 'day-checkin' },
    h('div', { class: 'label' }, 'Check-in'),
    isWorkday(key, rec)
      ? h('div', { class: 'gap' }, scale({ n: 5, value: rec.energy4pm ?? null, label: 'Energy at 4 PM', low: '1 drained', high: '5 sharp', name: 'energy',
        onChange: (v) => store.updateDay(key, { energy4pm: v }) }))
      : null,
    h('div', { class: 'gap' }, choice({ label: 'Trained', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }], value: rec.trained ?? null, cols: 2, name: 'trained',
      onChange: (v) => store.updateDay(key, { trained: v, trainingType: v ? rec.trainingType || null : null }) })),
    rec.trained
      ? h('div', { class: 'gap' }, choice({ label: 'Type', options: TRAINING_OPTIONS, value: rec.trainingType || null, cols: 3, name: 'training-type',
        onChange: (v) => store.updateDay(key, { trainingType: v }) }))
      : null);
}

function temptationSection(ctx, app, key) {
  const items = temptationsOfDay(ctx, key);
  if (!items.length) return null;
  return h('section', { class: 'section', 'data-block': 'day-temptations' },
    h('div', { class: 'label' }, 'Temptations'),
    h('ul', { class: 'list gap-s' }, items.map((t) => h('li', {},
      h('button', { type: 'button', class: 'item', onclick: () => showTemptationSheet(app, t.id) },
        h('span', {}, `${t.trigger || 'no trigger'}: ${t.outcome ? OUTCOME_TEXT[t.outcome].toLowerCase() : 'no outcome'}`),
        h('span', { class: 'item-side' }, fmtTime(t.startedAt)))))));
}

function showOutsideEditSheet(app, id) {
  const o = store.state.outside.get(id);
  if (!o) return;
  const draft = { trigger: o.trigger, amount: o.amount, minutes: minutesOfDay(o.at) };
  let confirming = false;
  openSheet((api) => h('div', {},
    sheetHead(api, 'Outside the window'),
    h('section', { class: 'section flush' }, choice({ label: 'What set it off', options: TRIGGER_OPTIONS, value: draft.trigger, cols: 3, name: 'trigger', onChange: (v) => { draft.trigger = v; } })),
    h('section', { class: 'section' }, choice({ label: 'How much', options: AMOUNT_OPTIONS, value: draft.amount, cols: 2, name: 'amount', onChange: (v) => { draft.amount = v; } })),
    h('section', { class: 'section' }, timeField({ label: 'At', minutes: draft.minutes, name: 'outside-at', onChange: (m) => { draft.minutes = m; } })),
    h('div', { class: 'gap' }, button('Save', async () => {
      // An unchanged time keeps its exact moment; a changed one stays next to it.
      const when = draft.minutes === minutesOfDay(o.at) ? o.at : nearestTime(o.at, draft.minutes);
      await store.updateOutside(id, { trigger: draft.trigger, amount: draft.amount, at: when });
      api.close();
    }, { block: true, name: 'save-outside' })),
    h('div', { class: 'gap-s' }, confirming
      ? h('div', { class: 'btn-row' }, h('span', { class: 'small' }, 'Delete this entry?'),
        button('Delete', async () => { await store.deleteOutside(id); api.close(); }, { kind: 'secondary', name: 'confirm-delete-outside' }),
        button('Keep', () => { confirming = false; api.rerender(); }, { kind: 'secondary' }))
      : button('Delete entry', () => { confirming = true; api.rerender(); }, { kind: 'secondary', name: 'delete-outside' })),
  ), { name: 'edit-outside', label: 'Outside the window' });
}

function showTemptationSheet(app, id) {
  const t = store.state.temptations.get(id);
  if (!t) return;
  let confirming = false;
  openSheet((api) => h('div', {},
    sheetHead(api, 'Temptation'),
    h('p', { class: 'statement' }, `${fmtTime(t.startedAt)}, ${t.trigger || 'no trigger'}`),
    h('p', { class: 'gap-s' }, t.outcome ? OUTCOME_TEXT[t.outcome] : 'No outcome recorded.'),
    (t.urges || []).length ? h('p', { class: 'quiet small gap-s' }, `Urge ratings: ${(t.urges || []).map((u) => u.value).join(', ')}.`) : null,
    h('div', { class: 'gap-l' }, confirming
      ? h('div', { class: 'btn-row' }, h('span', { class: 'small' }, 'Delete this entry?'),
        button('Delete', async () => { await store.deleteTemptation(id); api.close(); }, { kind: 'secondary', name: 'confirm-delete-temptation' }),
        button('Keep', () => { confirming = false; api.rerender(); }, { kind: 'secondary' }))
      : button('Delete entry', () => { confirming = true; api.rerender(); }, { kind: 'secondary', name: 'delete-temptation' })),
  ), { name: 'temptation-detail', label: 'Temptation' });
}
