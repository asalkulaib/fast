// Fasting stages on Today: a 24-hour ring timed from the last bite, shown
// only while fasting. The hours already fasted fill the ring in warm rock; a
// gold marker shows the present; a cream tick marks the fasting goal (the
// day less the eating window); a line icon marks each stage, the current
// one in gold. The stages themselves are never a target.

import { h, s, live } from './dom.js';
import { button, legend } from './components.js';
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
const FILL = '#4B2E14'; // --rock-700: time already fasted
const TRACK = '#D8BF93'; // --sand-300: time still ahead on the ring
const SURFACE = '#E6D0A8'; // --bg: halo around the marks
const MARK = '#F0B25C'; // --accent: now, a needle of gold leaf
const INK = '#1E140C'; // --ink: edges, ticks and the fasting goal

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

function ringSvg(state, goalHours) {
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
  // The fasting goal: an ink bar across the ring, edged in sand so it shows on both tones.
  const [gx, gy] = point(goalHours, R - WIDTH / 2 - 1);
  const [hx, hy] = point(goalHours, R + WIDTH / 2 + 1);
  const goalLine = (stroke, w, testid) => s('line', {
    x1: gx.toFixed(2), y1: gy.toFixed(2), x2: hx.toFixed(2), y2: hy.toFixed(2),
    stroke, 'stroke-width': w, 'data-testid': testid || null, 'data-hours': testid ? String(goalHours) : null,
  });
  const goal = [goalLine(SURFACE, 5), goalLine(INK, 2, 'goal-tick')];
  // An engraved scale: a tick for every hour, longer every six.
  const ticks = Array.from({ length: SCALE_HOURS }, (_, hour) => {
    const [ax, ay] = point(hour, R + WIDTH / 2 + 3);
    const [bx, by] = point(hour, R + WIDTH / 2 + (hour % 6 ? 6 : 10));
    return s('line', {
      x1: ax.toFixed(2), y1: ay.toFixed(2), x2: bx.toFixed(2), y2: by.toFixed(2),
      stroke: INK, 'stroke-opacity': hour % 6 ? 0.35 : 0.7, 'stroke-width': 1,
    });
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
  }, ...ticks, ...arcs, ...goal, marker(SURFACE, 9), marker(INK, 5), marker(MARK, 3, 'stage-marker'), ...icons);
}

/** The ring with the time fasted and the stage in its centre. */
function fastingRing(state, lastBiteTs, compact, goalHours) {
  return h('div', {
    class: `ring-wrap${compact ? ' compact' : ''}`,
    role: 'img',
    'data-testid': 'fasting-ring',
    'data-stage': state.stage.key,
    'aria-label': `Fasting for ${fmtDuration(state.elapsedMs)}. Stage: ${state.stage.name}.`,
  },
    ringSvg(state, goalHours),
    h('div', { class: 'ring-centre', 'aria-hidden': 'true' },
      live('div', { class: 'ring-time', 'data-testid': 'fasting-for' }, (t) => fmtElapsed(t - lastBiteTs)),
      h('div', { class: 'ring-stage', 'data-testid': 'stage-name' }, state.stage.name)));
}

/** What each mark on the ring means. */
const ringLegend = () => legend([
  ['fasted', 'Hours fasted'], ['ahead', 'Still ahead'], ['needle', 'Now'], ['goal', 'Fasting goal'], ['stage-now', 'Current stage icon'],
], 'ring-legend');

/** Under the ring, live: how far the fasting goal is, then the next stage. */
function ringLines(state, lastBiteTs, goalHours) {
  return h('p', { class: 'quiet small gap ring-lines' },
    live('span', { 'data-testid': 'goal-line' }, (t) => {
      const left = goalHours * HOUR - (t - lastBiteTs);
      return left > 0 ? `Fasting goal ${goalHours} h: ${fmtDuration(left)} to go.` : `Fasting goal of ${goalHours} h reached.`;
    }),
    state.next
      ? [h('br'), live('span', { 'data-testid': 'stage-next' },
        (t) => `Next: ${state.next.name.toLowerCase()}, in about ${fmtDuration(Math.max(0, state.next.from * HOUR - (t - lastBiteTs)))}.`)]
      : null);
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
  const goalHours = 24 - Math.round(ctx.windowMsFor(ctx.todayKey) / HOUR);
  return markStage(h('div', { class: 'ring-hero gap' },
    fastingRing(state, lastBiteTs, false, goalHours), ringLegend(), ringLines(state, lastBiteTs, goalHours)), state, ctx.nowTs);
}

/**
 * The stage section. Before the window it holds the explanation under the
 * hero ring; after the window it holds a smaller ring as well.
 */
export function stagesSection(ctx, app, lastBiteTs, { withRing }) {
  if (!lastBiteTs) return null;
  const state = fastingState(lastBiteTs, ctx.nowTs);
  const goalHours = 24 - Math.round(ctx.windowMsFor(ctx.todayKey) / HOUR);
  return markStage(h('section', { class: 'section', 'data-block': 'stages', 'data-stage': state.stage.key },
    withRing
      ? [h('div', { class: 'label' }, 'Fasting'), fastingRing(state, lastBiteTs, true, goalHours), ringLegend(), ringLines(state, lastBiteTs, goalHours)]
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
