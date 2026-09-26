// Fasting stages on Today: a 24-hour ring timed from the last bite, shown
// only while fasting. Never a goal: no targets, no pass or fail.
// The hours already fasted fill the ring in warm rock; a gold marker shows
// the present; a line icon marks each stage, the current one in gold.

import { h, s, live } from './dom.js';
import { button } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import { HOUR, fmtDuration, fmtElapsed } from '../core/time.js';
import { AUTOPHAGY_NOTE, SCALE_HOURS, SOURCES, STAGES, VARIATION_NOTE, fastingState } from '../core/stages.js';
import { stageIcon } from './icons.js';

const SIZE = 300;
const C = SIZE / 2; // centre
const R = 108; // ring radius
const WIDTH = 12; // ring thickness
const ICON_R = 136; // icons sit just outside the ring
const GAP = 0.12; // hours of surface gap between stages
const FILL = '#C58E50'; // --rock-400: time already fasted
const TRACK = '#4B2E14'; // --rock-700: time still ahead on the ring
const SURFACE = '#05060B'; // --bg: halo around the marker
const MARK = '#F0B25C'; // --accent: now

// Where each icon sits: beside its stage's arc, and the open-ended last
// stage at the 24-hour mark where it begins (the top of the ring).
const ICON_AT = { digesting: 2, settling: 8, switch: 18, ketones: 24 };

function point(hours, radius) {
  const a = (hours / SCALE_HOURS) * 2 * Math.PI;
  return [C + radius * Math.sin(a), C - radius * Math.cos(a)];
}

function arc(h0, h1, stroke) {
  const [x0, y0] = point(h0, R);
  const [x1, y1] = point(h1, R);
  const large = (h1 - h0) / SCALE_HOURS > 0.5 ? 1 : 0;
  return s('path', {
    d: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    fill: 'none',
    stroke,
    'stroke-width': WIDTH,
    'stroke-linecap': 'butt',
  });
}

function ringSvg(state) {
  const now = Math.min(state.elapsedMs / HOUR, SCALE_HOURS);
  const arcs = [];
  for (const st of STAGES.filter((x) => x.from < SCALE_HOURS)) {
    const a = st.from + GAP / 2;
    const b = Math.min(st.to, SCALE_HOURS) - GAP / 2;
    if (now > a) arcs.push(arc(a, Math.min(b, now), FILL));
    if (now < b) arcs.push(arc(Math.max(a, now), b, TRACK));
  }
  const [ix, iy] = point(now, R - WIDTH / 2 - 5);
  const [ox, oy] = point(now, R + WIDTH / 2 + 5);
  const marker = (color, w, testid) => s('line', {
    x1: ix.toFixed(2), y1: iy.toFixed(2), x2: ox.toFixed(2), y2: oy.toFixed(2),
    stroke: color, 'stroke-width': w, 'stroke-linecap': 'butt', 'data-testid': testid || null,
    'data-hours': testid ? (state.elapsedMs / HOUR).toFixed(1) : null,
  });
  const icons = STAGES.map((st) => {
    const [x, y] = point(ICON_AT[st.key], ICON_R);
    return stageIcon(st.key, { x, y, size: 22, current: st.key === state.stage.key });
  });
  return s('svg', {
    class: 'ring',
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    'aria-hidden': 'true',
    focusable: 'false',
  }, ...arcs, marker(SURFACE, 8), marker(MARK, 3, 'stage-marker'), ...icons);
}

/** The ring with the time fasted and the stage in its centre. */
function fastingRing(state, lastBiteTs, compact) {
  return h('div', {
    class: `ring-wrap${compact ? ' compact' : ''}`,
    role: 'img',
    'data-testid': 'fasting-ring',
    'data-stage': state.stage.key,
    'aria-label': `Fasting for ${fmtDuration(state.elapsedMs)}. Stage: ${state.stage.name}.`,
  },
    ringSvg(state),
    h('div', { class: 'ring-centre', 'aria-hidden': 'true' },
      live('div', { class: 'ring-time', 'data-testid': 'fasting-for' }, (t) => fmtElapsed(t - lastBiteTs)),
      h('div', { class: 'ring-stage', 'data-testid': 'stage-name' }, state.stage.name)));
}

function nextLine(state, lastBiteTs) {
  if (!state.next) return null;
  return h('p', { class: 'quiet small gap', 'data-testid': 'stage-next' },
    live('span', {}, (t) => `Next: ${state.next.name.toLowerCase()}, in about ${fmtDuration(Math.max(0, state.next.from * HOUR - (t - lastBiteTs)))}.`));
}

let shownStage = null;
let fadeAt = null; // the render in which a new stage arrived

/** A new stage arrives with a soft fade on everything drawn in that render. */
function markStage(el, state, renderTs) {
  if (shownStage !== null && shownStage !== state.stage.key) fadeAt = renderTs;
  shownStage = state.stage.key;
  if (fadeAt === renderTs) el.classList.add('fade-in');
  return el;
}

/** Before the window: the ring leads Today. */
export function ringHero(ctx, lastBiteTs) {
  const state = fastingState(lastBiteTs, ctx.nowTs);
  return markStage(h('div', { class: 'ring-hero gap' }, fastingRing(state, lastBiteTs, false), nextLine(state, lastBiteTs)), state, ctx.nowTs);
}

/**
 * The stage section. Before the window it holds the explanation under the
 * hero ring; after the window it holds a smaller ring as well.
 */
export function stagesSection(ctx, app, lastBiteTs, { withRing }) {
  if (!lastBiteTs) return null;
  const state = fastingState(lastBiteTs, ctx.nowTs);
  return markStage(h('section', { class: 'section', 'data-block': 'stages', 'data-stage': state.stage.key },
    withRing
      ? [h('div', { class: 'label' }, 'Fasting'), fastingRing(state, lastBiteTs, true), nextLine(state, lastBiteTs)]
      : h('div', { class: 'label' }, state.stage.name),
    h('p', { class: 'gap-s' }, state.stage.text),
    h('div', { class: 'gap-s' }, button('About the stages', () => showStagesSheet(), { kind: 'secondary', name: 'about-stages' })),
  ), state, ctx.nowTs);
}

export function showStagesSheet() {
  openSheet((api) => h('div', {},
    sheetHead(api, 'Fasting stages'),
    h('p', {}, 'Typical changes after your last bite, from human studies.'),
    h('ul', { class: 'list gap', 'data-testid': 'stage-list' }, STAGES.map((st) => h('li', {},
      h('div', { class: 'stage-row' },
        h('span', { class: 'stage-title' },
          s('svg', { class: 'stage-row-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, stageIcon(st.key)),
          h('span', { class: 'statement' }, st.name)),
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
