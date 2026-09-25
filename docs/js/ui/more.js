// More: planned times, calendar reminders, exports, backup and restore.

import { h } from './dom.js';
import { button, timeField } from './components.js';
import * as store from '../store.js';
import { fmtMinutes, toMinutes } from '../core/time.js';
import { icsTimes } from '../core/ics.js';
import { VERSION } from '../version.js';
import { ago, header, note } from './shared.js';

function timeSetting(label, key, ctx) {
  return timeField({
    label,
    minutes: toMinutes(ctx.settings[key]),
    name: key,
    onChange: (m) => store.setSettings({ [key]: fmtMinutes(m) }),
  });
}

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function calendarStatus(ctx) {
  const s = ctx.settings;
  if (!s.icsTimes) return h('p', { class: 'small quiet gap-s', 'data-testid': 'ics-status' }, 'Not added yet.');
  if (s.icsTimes !== icsTimes(s)) {
    return h('p', { class: 'small gap-s', 'data-testid': 'ics-status' },
      'Your times changed since the last file. Add the new file, then delete the old Fast events: open one, tap Delete Event, then Delete All Future Events.');
  }
  return h('p', { class: 'small quiet gap-s', 'data-testid': 'ics-status' }, 'Added with your current times.');
}

export function renderMore(ctx, app) {
  const s = ctx.settings;
  const restoreInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'data-testid': 'restore-input' });
  restoreInput.addEventListener('change', () => {
    const file = restoreInput.files && restoreInput.files[0];
    restoreInput.value = '';
    if (file) app.restoreFrom(file);
  });

  return h('div', { class: 'more' },
    header(ctx, app, { title: 'More' }),
    h('section', { class: 'section strong' },
      h('h1', { class: 'display' }, 'Settings'),
      h('p', { class: 'gap' }, 'Planned times drive reminders and the Tempted? flow. Success depends only on your 4 hours.')),
    h('section', { class: 'section', 'data-block': 'planned' },
      h('div', { class: 'label' }, 'Planned window start'),
      h('div', { class: 'btn-pair gap' },
        timeSetting('Workdays', 'workdayStart', ctx),
        timeSetting('Weekends', 'weekendStart', ctx)),
      h('p', { class: 'small quiet gap-s' }, 'Workdays run Sunday to Thursday; weekends are Friday and Saturday.')),
    h('section', { class: 'section', 'data-block': 'reminder-times' },
      h('div', { class: 'label' }, 'Reminder times, Sun to Thu'),
      h('div', { class: 'btn-pair gap' },
        timeSetting('Hold the line', 'holdTime', ctx),
        timeSetting('Training', 'trainingTime', ctx))),
    h('section', { class: 'section', 'data-block': 'calendar' },
      h('div', { class: 'label' }, 'Calendar reminders'),
      h('p', { class: 'gap-s' },
        `Four repeating alerts for your iPhone Calendar: hold the line at ${s.holdTime} and training at ${s.trainingTime} on workdays, `
        + `and your window at ${s.workdayStart} on workdays and ${s.weekendStart} at weekends.`),
      calendarStatus(ctx),
      h('div', { class: 'gap' }, button('Add to Calendar', () => app.addCalendar(), { block: true, name: 'add-calendar' })),
      h('p', { class: 'small quiet gap-s' }, 'In the share sheet choose Calendar. If it is not listed, choose Save to Files, then open the file in Files and tap Add All.')),
    h('section', { class: 'section', 'data-block': 'export' },
      h('div', { class: 'label' }, 'Export'),
      h('p', { class: 'gap-s' }, 'CSV files for Excel: windows, meals, weight, check-ins and temptations. The weight file holds your raw entries.'),
      h('div', { class: 'gap' }, button('Export CSV files', () => app.exportCsv(), { block: true, name: 'export-csv' }))),
    h('section', { class: 'section', 'data-block': 'backup' },
      h('div', { class: 'label' }, 'Backup'),
      h('p', { class: 'gap-s', 'data-testid': 'backup-status' }, s.lastBackupAt ? `Last backup ${ago(s.lastBackupAt, ctx.nowTs)}.` : 'No backup yet.'),
      h('p', { class: 'small quiet' }, 'Everything lives only on this iPhone. Back up once a week and keep the file in Files or iCloud Drive.'),
      h('div', { class: 'gap' }, button('Back up now', () => app.backup(), { block: true, name: 'backup' })),
      h('div', { class: 'gap-s' }, button('Restore from a backup', () => restoreInput.click(), { kind: 'secondary', name: 'restore' })),
      restoreInput),
    h('section', { class: 'section', 'data-block': 'storage' },
      h('div', { class: 'label' }, 'Storage'),
      h('p', { class: 'small gap-s' },
        s.persisted === true
          ? 'Kept on this iPhone. The browser has agreed not to clear it when space runs low.'
          : 'iOS may clear this data if the iPhone runs very low on space. Weekly backups keep it safe.'),
      isStandalone()
        ? null
        : h('p', { class: 'small gap-s' }, 'You are using Fast in the browser. Add it to your Home Screen and use it from there: the Home Screen app keeps its own data.')),
    h('section', { class: 'section', 'data-block': 'help' },
      h('div', { class: 'label' }, 'Help'),
      h('div', { class: 'gap-s' }, button('Weight Shortcut and Home Screen setup', () => app.go('help'), { kind: 'secondary', name: 'help' }))),
    h('div', { class: 'row gap-l' },
      h('div', { class: 'main' }),
      h('div', { class: 'margin' }, note('Version', VERSION))),
  );
}
