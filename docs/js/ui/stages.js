// Fasting stages on Today: a 24-hour stage bar timed from the last bite,
// shown only while fasting. Never a goal: no targets, no pass or fail.

import { h, s, hl, live } from './dom.js';
import { button } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import { HOUR, fmtDuration, fmtElapsed } from '../core/time.js';
import { AUTOPHAGY_NOTE, SCALE_HOURS, SOURCES, STAGES, VARIATION_NOTE, fastingState } from '../core/stages.js';

const W = 340;
const BAR_Y = 8;
const BAR_H = 12;
const GAP = 2; // surface gap between stages
const FILL = '#C58E50'; // --rock-400: time already fasted
const TRACK = '#4B2E14'; // --rock-700: time still ahead on the scale
const SURFACE = '#05060B'; // --bg: ring around the marker
const MARK = '#F0B25C'; // --accent: where you are now

const x = (hours) => (Math.min(hours, SCALE_HOURS) / SCALE_HOURS) * W;

function stageBar(state) {
  const now = state.position * W;
  const parts = [];
  STAGES.filter((st) => st.from < SCALE_HOURS).forEach((st, i, list) => {
    const x0 = x(st.from) + (i === 0 ? 0 : GAP / 2);
    const x1 = x(st.to) - (i === list.length - 1 ? 0 : GAP / 2);
    const filledTo = Math.max(x0, Math.min(x1, now));
    if (filledTo > x0) parts.push(s('rect', { x: x0.toFixed(1), y: BAR_Y, width: (filledTo - x0).toFixed(1), height: BAR_H, fill: FILL }));
    if (x1 > filledTo) parts.push(s('rect', { x: filledTo.toFixed(1), y: BAR_Y, width: (x1 - filledTo).toFixed(1), height: BAR_H, fill: TRACK }));
  });
  const mx = Math.max(1.5, Math.min(W - 1.5, now));
  const ticks = [
    [0, '0', 'start'],
    ...STAGES.filter((st) => st.from > 0 && st.from < SCALE_HOURS).map((st) => [x(st.from), String(st.from), 'middle']),
    [W, `${SCALE_HOURS} h`, 'end'],
  ];
  return s('svg', {
    class: 'stage-bar',
    viewBox: `0 0 ${W} 42`,
    role: 'img',
    'aria-label': `Fasting for ${fmtDuration(state.elapsedMs)}: ${state.stage.name}.`,
  },
    ...parts,
    s('rect', { x: (mx - 3.5).toFixed(1), y: BAR_Y - 6, width: 7, height: BAR_H + 12, fill: SURFACE }),
    s('rect', { x: (mx - 1.5).toFixed(1), y: BAR_Y - 5, width: 3, height: BAR_H + 10, fill: MARK, 'data-testid': 'stage-marker' }),
    ...ticks.map(([tx, label, anchor]) => s('text', { x: tx, y: 40, 'text-anchor': anchor }, label)),
  );
}

let shownStage = null;

/** The stages section, or null when no bite has been logged yet. */
export function stagesSection(ctx, app, lastBiteTs) {
  if (!lastBiteTs) return null;
  const state = fastingState(lastBiteTs, ctx.nowTs);
  const section = h('section', { class: 'section', 'data-block': 'stages', 'data-stage': state.stage.key },
    h('div', { class: 'stage-head' },
      h('div', { class: 'label' }, 'Fasting'),
      live('div', { class: 'stage-elapsed num', 'data-testid': 'fasting-for' }, (t) => fmtElapsed(t - lastBiteTs))),
    h('div', { class: 'gap-s' }, stageBar(state)),
    h('p', { class: 'statement gap', 'data-testid': 'stage-name' }, hl(state.stage.name)),
    h('p', { class: 'gap-s' }, state.stage.text),
    state.next
      ? h('p', { class: 'quiet small gap-s', 'data-testid': 'stage-next' },
        live('span', {}, (t) => `Next: ${state.next.name.toLowerCase()}, in about ${fmtDuration(Math.max(0, state.next.from * HOUR - (t - lastBiteTs)))}.`))
      : null,
    h('div', { class: 'gap-s' }, button('About the stages', () => showStagesSheet(), { kind: 'secondary', name: 'about-stages' })),
  );
  // A new stage arrives with a soft fade.
  if (shownStage !== null && shownStage !== state.stage.key) section.classList.add('fade-in');
  shownStage = state.stage.key;
  return section;
}

export function showStagesSheet() {
  openSheet((api) => h('div', {},
    sheetHead(api, 'Fasting stages'),
    h('p', {}, 'Typical changes after your last bite, from human studies.'),
    h('ul', { class: 'list gap', 'data-testid': 'stage-list' }, STAGES.map((st) => h('li', {},
      h('div', { class: 'stage-row' },
        h('span', { class: 'statement' }, st.name),
        h('span', { class: 'label' }, st.range)),
      h('p', { class: 'gap-s' }, st.text)))),
    h('p', { class: 'small quiet gap' }, VARIATION_NOTE),
    h('section', { class: 'section gap' },
      h('div', { class: 'label' }, 'Autophagy'),
      h('p', { class: 'gap-s', 'data-testid': 'autophagy-note' }, AUTOPHAGY_NOTE)),
    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Sources'),
      h('ol', { class: 'steps gap-s small' }, SOURCES.map((src) => h('li', {}, h('span', {}, src))))),
  ), { name: 'stages', label: 'Fasting stages' });
}
