// Fasting stages on Today: the fast drawn as the sun crossing the Nafud,
// timed from the last bite and shown only while fasting. The sun's path
// arcs over the dunes from the left horizon (the last bite) to the right
// (24 hours); the hours already fasted are laid in dark rock behind the sun,
// a dark tick marks the fasting goal (the day less the eating window), and a
// line icon marks each stage, the current one set in ink. Past 24 hours the
// sun rests on the far horizon. The stages are never a target.

import { h, s, live, hl } from './dom.js';
import { button, key, legend } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import { HOUR, fmtDuration, fmtElapsed } from '../core/time.js';
import { AUTOPHAGY_NOTE, SCALE_HOURS, SOURCES, STAGES, VARIATION_NOTE, fastingState } from '../core/stages.js';
import { stageIcon } from './icons.js';

const W = 340;
const HT = 214;
const CX = 170;
const CY = 176; // the horizon
const R = 132; // the sun's path
const WIDTH = 12; // path thickness
const ICON_R = 158; // icons sit just outside the path
const GAP = 0.12; // hours of surface gap between stages
const FILL = '#4B2E14'; // --rock-700: hours already fasted
const TRACK = '#D8BF93'; // --sand-300: hours still ahead
const SURFACE = '#E6D0A8'; // --bg: halo around the marks
const SUN = '#F0B25C'; // --accent: the sun, gold leaf
const INK = '#1E140C'; // --ink: edges, ticks and the fasting goal

// Where each icon sits: beside its stage's stretch of the path; the
// open-ended last stage near the far horizon, above the dunes.
const ICON_AT = { digesting: 2, settling: 8, switch: 18, ketones: 22.5 };

/** A point on the path: 0 hours on the left horizon, 12 overhead, 24 on the right. */
function point(hours, radius) {
  const a = Math.PI * (1 - hours / SCALE_HOURS);
  return [CX + radius * Math.cos(a), CY - radius * Math.sin(a)];
}

function arc(h0, h1, stroke) {
  const [x0, y0] = point(h0, R);
  const [x1, y1] = point(h1, R);
  return s('path', {
    d: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    fill: 'none',
    stroke,
    'stroke-width': WIDTH,
    'stroke-linecap': 'butt',
  });
}

/** The Nafud along the horizon: far ridge, middle dune, lit near dune. */
function dunes() {
  return [
    s('path', { fill: '#D8BF93', d: 'M0 214 C6 200 18 186 40 180 C90 170 140 176 190 180 C236 184 276 172 304 178 C322 182 334 198 340 214 Z' }),
    s('path', { fill: '#C9A26C', d: 'M14 214 C24 202 40 194 70 191 C120 186 170 194 214 197 C256 200 290 190 312 196 C322 200 328 206 330 214 Z' }),
    s('path', { fill: '#C58E50', d: 'M40 214 C56 206 84 202 120 203 C170 205 214 210 256 207 C280 205 296 206 304 214 Z' }),
  ];
}

function dialSvg(state, goalHours) {
  const now = Math.min(state.elapsedMs / HOUR, SCALE_HOURS);
  const arcs = [];
  for (const st of STAGES.filter((x) => x.from < SCALE_HOURS)) {
    const a = st.from + GAP / 2;
    const b = Math.min(st.to, SCALE_HOURS) - GAP / 2;
    if (now > a) arcs.push(arc(a, Math.min(b, now), FILL));
    if (now < b) arcs.push(arc(Math.max(a, now), b, TRACK));
  }
  // An engraved scale: a tick for every hour, longer every six.
  const ticks = Array.from({ length: SCALE_HOURS + 1 }, (_, hour) => {
    const [ax, ay] = point(hour, R + WIDTH / 2 + 3);
    const [bx, by] = point(hour, R + WIDTH / 2 + (hour % 6 ? 6 : 10));
    return s('line', {
      x1: ax.toFixed(2), y1: ay.toFixed(2), x2: bx.toFixed(2), y2: by.toFixed(2),
      stroke: INK, 'stroke-opacity': hour % 6 ? 0.35 : 0.7, 'stroke-width': 1,
    });
  });
  // The fasting goal: an ink bar across the path, edged in sand so it shows on both tones.
  const [gx, gy] = point(goalHours, R - WIDTH / 2 - 1);
  const [hx, hy] = point(goalHours, R + WIDTH / 2 + 1);
  const goalLine = (stroke, w, testid) => s('line', {
    x1: gx.toFixed(2), y1: gy.toFixed(2), x2: hx.toFixed(2), y2: hy.toFixed(2),
    stroke, 'stroke-width': w, 'data-testid': testid || null, 'data-hours': testid ? String(goalHours) : null,
  });
  // The sun, where the fast stands now; it sets behind the dunes at 24 hours.
  const [sx, sy] = point(now, R);
  const sun = [
    s('circle', { cx: sx.toFixed(2), cy: sy.toFixed(2), r: 12, fill: SURFACE }),
    s('circle', {
      cx: sx.toFixed(2), cy: sy.toFixed(2), r: 9, fill: SUN, stroke: INK, 'stroke-width': 1.5,
      'data-testid': 'stage-marker', 'data-hours': (state.elapsedMs / HOUR).toFixed(1),
    }),
  ];
  const icons = STAGES.map((st) => {
    const [x, y] = point(ICON_AT[st.key], ICON_R);
    return stageIcon(st.key, { x, y, size: 22, current: st.key === state.stage.key });
  });
  return s('svg', {
    class: 'ring dial',
    viewBox: `0 0 ${W} ${HT}`,
    'aria-hidden': 'true',
    focusable: 'false',
  }, ...ticks, ...arcs, goalLine(SURFACE, 5), goalLine(INK, 2, 'goal-tick'), ...sun, ...dunes(), ...icons);
}

/** The dial with the time fasted and the stage under the arc. */
function fastingRing(state, lastBiteTs, compact, goalHours) {
  return h('div', {
    class: `ring-wrap dial-wrap${compact ? ' compact' : ''}`,
    role: 'img',
    'data-testid': 'fasting-ring',
    'data-stage': state.stage.key,
    'aria-label': `Fasting for ${fmtDuration(state.elapsedMs)}. Stage: ${state.stage.name}.`,
  },
    dialSvg(state, goalHours),
    h('div', { class: 'ring-centre', 'aria-hidden': 'true' },
      live('div', { class: 'ring-time', 'data-testid': 'fasting-for' }, (t) => fmtElapsed(t - lastBiteTs)),
      h('div', { class: 'ring-stage', 'data-testid': 'stage-name' }, state.stage.name)));
}

/** What each mark on the dial means. */
const ringLegend = () => legend([
  ['fasted', 'Hours fasted'], ['ahead', 'Still ahead'], [key('sun'), 'Now'], ['goal', 'Fasting goal'], [key('stage'), 'Current stage icon'],
], 'ring-legend');

/** Under the dial, live: how far the fasting goal is, then the next stage. Gold once the goal is reached. */
function ringLines(state, lastBiteTs, goalHours) {
  const reached = state.elapsedMs >= goalHours * HOUR;
  return h('p', { class: 'quiet small gap ring-lines' },
    reached
      ? h('span', { 'data-testid': 'goal-line' }, `Fasting goal of ${goalHours} h `, hl('reached'), '.')
      : live('span', { 'data-testid': 'goal-line' }, (t) => {
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
      ? [fastingRing(state, lastBiteTs, true, goalHours), ringLegend(), ringLines(state, lastBiteTs, goalHours)]
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
