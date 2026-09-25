// Weight: the 7-day average, its weekly change and weekly averages.
// A daily weight is never shown, and there is no way to type one in.

import { h, hl } from './dom.js';
import { button } from './components.js';
import { fmtDayMonth } from '../core/time.js';
import { rollingSummary, weeklyAverages, MIN_WEIGH_INS } from '../core/weight.js';
import { dunes } from './art.js';
import { weightChart, weightTable } from './chart.js';
import { ago, header, note } from './shared.js';

export const SHORTCUT_NAME = 'Fast Weight';
export const SHORTCUT_URL = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;

const signedKg = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} kg`;

/** A paste target that accepts a paste only and never shows it. */
function pasteTarget(app) {
  const area = h('textarea', {
    class: 'paste-target',
    rows: '1',
    inputmode: 'none',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-label': 'Paste the weight data here',
    placeholder: 'Long-press here, then tap Paste',
    'data-testid': 'paste-target',
  });
  area.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertFromPaste') e.preventDefault();
  });
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    area.value = '';
    area.blur();
    app.importText(text);
  });
  area.addEventListener('input', () => {
    const text = area.value;
    area.value = '';
    if (text) app.importText(text);
  });
  return area;
}

function importSection(ctx, app) {
  const last = ctx.settings.lastImportAt;
  return h('section', { class: 'section', 'data-block': 'import' },
    h('div', { class: 'label' }, 'Import'),
    h('p', { class: 'small quiet gap-s' }, last ? `Last import ${ago(last, ctx.nowTs)}.` : 'Nothing imported yet.'),
    h('div', { class: 'gap' }, button('Import weight', () => app.importWeight(), { block: true, name: 'import-weight' })),
    app.ui.showPaste
      ? h('div', { class: 'gap-l', 'data-block': 'paste' },
        h('p', { class: 'small' }, 'If the clipboard could not be read, paste here instead. Nothing you paste is shown.'),
        pasteTarget(app))
      : null,
    h('div', { class: 'btn-row gap' },
      h('a', { class: 'btn-2', href: SHORTCUT_URL, 'data-action': 'run-shortcut' }, 'Run the Fast Weight shortcut'),
      button('How to set up the Shortcut', () => app.go('help'), { kind: 'secondary', name: 'shortcut-help' })),
  );
}

export function renderWeight(ctx, app) {
  const summary = rollingSummary(ctx.weights);
  const weekly = weeklyAverages(ctx.weights);
  const head = header(ctx, app, { title: 'Weight' });

  if (!ctx.weights.size) {
    return h('div', { class: 'weight empty' },
      head,
      h('section', { class: 'section strong' },
        h('h1', { class: 'display' }, 'No weigh-ins yet'),
        h('p', { class: 'gap' }, 'Your scale sends each weigh-in to Apple Health. A Shortcut brings them here, and Fast shows only averages.')),
      importSection(ctx, app),
      dunes());
  }

  const cur = summary.current;
  return h('div', { class: 'weight' },
    head,
    h('section', { class: 'section strong' },
      h('div', { class: 'row' },
        h('div', { class: 'main' },
          h('div', { class: 'label' }, '7-day average'),
          cur.avg != null
            ? h('h1', { class: 'display gap-s', 'data-testid': 'weight-average' }, `${cur.avg.toFixed(1)} kg`)
            : h('p', { class: 'statement gap-s', 'data-testid': 'weight-average' }, `Needs ${MIN_WEIGH_INS} weigh-ins in 7 days.`)),
        h('div', { class: 'margin' },
          note('Up to', fmtDayMonth(summary.end)),
          note('Weigh-ins', `${cur.n} of 7`))),
      summary.change != null
        ? h('p', { class: 'gap', 'data-testid': 'weight-change' }, 'Change from the 7 days before: ', hl(signedKg(summary.change)), '.')
        : h('p', { class: 'quiet small gap' }, 'The change appears once the 7 days before also have 3 weigh-ins.')),
    h('section', { class: 'section', 'data-block': 'chart' },
      h('div', { class: 'label' }, 'Weekly averages'),
      weekly.length
        ? h('div', { class: 'gap' },
          weightChart(weekly),
          app.ui.showTable ? h('div', { class: 'gap' }, weightTable(weekly)) : null,
          button(app.ui.showTable ? 'Hide the table' : 'Show as a table', () => { app.ui.showTable = !app.ui.showTable; app.refresh(); }, { kind: 'secondary', name: 'toggle-table' }))
        : h('p', { class: 'quiet small gap-s' }, 'The chart starts once a Sunday to Saturday week has 3 weigh-ins.')),
    importSection(ctx, app),
  );
}
