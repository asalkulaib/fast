// Correcting a window after the fact: its opening time while it is open
// (or removing a window opened by mistake), and both times once it is closed.

import { h } from './dom.js';
import { button, timeField } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import * as store from '../store.js';
import { MIN, fmtDuration, fmtTime, fmtWhen, minutesOfDay, now } from '../core/time.js';
import { timeOnOrAfter } from '../core/rules.js';
import { resolveFirstBite } from './meal.js';
import { mealsOfDay } from './shared.js';

const meals = (n) => (n === 1 ? 'Its meal goes too.' : `Its ${n} meals go too.`);

/** While the window is open: change when it opened, or remove it. */
export function showOpeningSheet(app, initialKey) {
  let key = initialKey;
  const start = store.state.days.get(key);
  const draft = { minutes: start && start.firstBite ? minutesOfDay(start.firstBite) : null, hint: '', confirm: false };
  openSheet((api) => {
    const ctx = app.ctx();
    const rec = ctx.days.get(key);
    if (!rec || !rec.firstBite) return h('div', {}, sheetHead(api, 'Window opened'), h('p', {}, 'No window is open.'));
    const logged = mealsOfDay(ctx, key).length;
    return h('div', {},
      sheetHead(api, 'Window opened'),
      h('p', {}, 'Set the time of your first bite. The countdown, the 4 hours and the 16:00 rule follow it.'),
      h('section', { class: 'section gap' },
        timeField({ label: 'First bite at', minutes: draft.minutes, name: 'opened-at', onChange: (m) => { draft.minutes = m; } })),
      draft.hint ? h('p', { class: 'small', 'data-testid': 'times-hint' }, draft.hint) : null,
      h('div', { class: 'gap' }, button('Save', async () => {
        const ts = draft.minutes == null ? null : resolveFirstBite(key, draft.minutes);
        if (ts == null) { draft.hint = 'That time is still ahead.'; api.rerender(); return; }
        const result = await store.adjustWindow(key, ts, null);
        if (result.error) { draft.hint = result.error; api.rerender(); return; }
        key = result.key;
        await api.close();
        app.flash(`The window now opens at ${fmtTime(ts)}.`);
      }, { block: true, name: 'save-opening' })),
      h('section', { class: 'section gap-l' },
        h('div', { class: 'label' }, 'Opened by mistake?'),
        draft.confirm
          ? h('div', { class: 'gap-s' },
            h('p', {}, `Remove the window opened at ${fmtTime(rec.firstBite)}?${logged ? ` ${meals(logged)}` : ''}`),
            h('div', { class: 'btn-row' },
              button('Remove window', async () => {
                await store.cancelWindow(key);
                await api.close();
                app.flash('Window removed. Tap First bite when you eat.');
              }, { kind: 'secondary', name: 'confirm-remove-window' }),
              button('Keep it', () => { draft.confirm = false; api.rerender(); }, { kind: 'secondary', name: 'keep-window' })))
          : h('div', { class: 'gap-s' },
            button('Remove this window', () => { draft.confirm = true; api.rerender(); }, { kind: 'secondary', name: 'remove-window' }))),
    );
  }, { name: 'opening', label: 'Window opened' });
}

/** Once the window is closed: change its first and last bite. */
export function showWindowTimesSheet(app, initialKey) {
  let key = initialKey;
  const start = store.state.days.get(key);
  const draft = {
    first: start && start.firstBite ? minutesOfDay(start.firstBite) : null,
    last: start && start.lastBite ? minutesOfDay(start.lastBite) : null,
    hint: '',
  };
  openSheet((api) => {
    const rec = store.state.days.get(key);
    if (!rec || !rec.firstBite) return h('div', {}, sheetHead(api, 'Window times'), h('p', {}, 'This window was removed.'));
    const firstTs = draft.first == null ? null : resolveFirstBite(key, draft.first);
    const lastTs = firstTs == null || draft.last == null ? null : timeOnOrAfter(firstTs, draft.last);
    const summary = firstTs == null
      ? 'That first bite is still ahead.'
      : lastTs == null ? '' : `${fmtTime(firstTs)} to ${fmtWhen(lastTs, key)}, ${fmtDuration(lastTs - firstTs)}.`;
    return h('div', {},
      sheetHead(api, 'Window times'),
      h('section', { class: 'section flush' },
        h('div', { class: 'btn-pair' },
          timeField({ label: 'First bite', minutes: draft.first, name: 'times-first', onChange: (m) => { draft.first = m; api.rerender(); } }),
          timeField({ label: 'Last bite', minutes: draft.last, name: 'times-last', onChange: (m) => { draft.last = m; api.rerender(); } })),
        h('p', { class: 'quiet small gap-s', 'data-testid': 'times-summary' }, summary)),
      draft.hint ? h('p', { class: 'small', 'data-testid': 'times-hint' }, draft.hint) : null,
      h('div', { class: 'gap' }, button('Save', async () => {
        if (firstTs == null || lastTs == null) { draft.hint = 'Enter both times in 24-hour form, like 17:30.'; api.rerender(); return; }
        if (lastTs > now() + MIN) { draft.hint = 'That last bite is still ahead.'; api.rerender(); return; }
        const result = await store.adjustWindow(key, firstTs, lastTs);
        if (result.error) { draft.hint = result.error; api.rerender(); return; }
        key = result.key;
        await api.close();
        app.flash('Window times saved.');
      }, { block: true, name: 'save-times' })),
    );
  }, { name: 'window-times', label: 'Window times' });
}
