// Fasting stages on Today: the fast drawn as the sun crossing the Nafud,
// timed from the last bite and shown only while fasting. The sun's path
// arcs over the dunes from the left horizon (the last bite) to the right
// (24 hours); the hours already fasted are laid in dark rock behind the sun,
// a dark tick marks the fasting goal (the day less the eating window), and a
// line icon marks each stage, the current one set in ink. Past 24 hours the
// sun rests on the far horizon, and the one icon there shows the stage the
// fast is in, or the next one. The stages are never a target.

import { h, s, live } from './dom.js';
import { button, durationFigure, key, legend } from './components.js';
import { openSheet, sheetHead } from './sheet.js';
import { HOUR, MIN, fmtDuration } from '../core/time.js';
import { AUTOPHAGY_NOTE, SCALE_HOURS, SOURCES, STAGES, VARIATION_NOTE, fastingState } from '../core/stages.js';
import { stageGlyph, stageIcon } from './icons.js';

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
const SURFACE = '#F1E3C7'; // --bg-raised, the panel: halo around the marks
const SUN = '#F0B25C'; // --accent: the sun, gold leaf
const INK = '#1E140C'; // --ink: edges, ticks and the fasting goal

// Where each icon sits: beside its stage's stretch of the path; the stages
// past a day share one place near the far horizon, above the dunes.
const ICON_AT = { digesting: 2, settling: 8, switch: 18 };
const BEYOND_AT = 22.5;

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
  // Past a day, the stage the fast is in; before it, the first stage past a day.
  const beyond = state.stage.from >= SCALE_HOURS ? state.stage : STAGES.find((st) => st.from >= SCALE_HOURS);
  const icons = [...STAGES.filter((st) => st.key in ICON_AT), beyond].map((st) => {
    const [x, y] = point(ICON_AT[st.key] ?? BEYOND_AT, ICON_R);
    return stageIcon(st.key, { x, y, size: 22, current: st.key === state.stage.key });
  });
  return s('svg', {
    class: 'ring dial',
    viewBox: `0 0 ${W} ${HT}`,
    'aria-hidden': 'true',
    focusable: 'false',
  }, ...ticks, ...arcs, goalLine(SURFACE, 5), goalLine(INK, 2, 'goal-tick'), ...sun, ...dunes(), ...icons);
}

/** The current stage as a small button under the time: it opens the stages at this one. */
function stageChip(stage) {
  return h('button', {
    type: 'button',
    class: 'stage-chip',
    'data-action': 'open-stages',
    'data-testid': 'stage-name',
    'aria-label': `Stage: ${stage.name}. About the stages`,
    onclick: () => showStagesSheet(stage.key),
  }, stageGlyph(stage.key, { mark: false }), h('span', {}, stage.name));
}

/** The dial with the time fasted and the stage under the arc. */
function fastingRing(state, lastBiteTs, compact, goalHours) {
  return h('div', {
    class: `ring-wrap dial-wrap${compact ? ' compact' : ''}`,
    'data-testid': 'fasting-ring',
    'data-stage': state.stage.key,
  },
    dialSvg(state, goalHours),
    h('div', { class: 'ring-centre' },
      h('span', { class: 'sr-only' }, 'Fasting for'),
      // Redrawn each minute: large digits, small units.
      live('div', { class: 'ring-time', 'data-testid': 'fasting-for' }, (t) => String(Math.round(Math.max(0, t - lastBiteTs) / MIN)), (mins) => durationFigure(Number(mins) * MIN)),
      stageChip(state.stage)));
}

/** What each mark on the dial means, in one row. */
const ringLegend = () => h('div', { class: 'ring-legend' }, legend([
  ['fasted', 'Fasted'], ['ahead', 'Ahead'], [key('sun'), 'Now'], ['goal', 'Goal'], [key('stage'), 'Stage'],
], 'ring-legend'));

/** How far the fasting goal is, then the next stage; live. */
function ringLines(state, lastBiteTs, goalHours) {
  const reached = state.elapsedMs >= goalHours * HOUR;
  return h('p', { class: 'quiet small gap ring-lines' },
    reached
      ? h('span', { 'data-testid': 'goal-line' }, `Fasting goal of ${goalHours} h reached.`)
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

/** The fasting goal in hours: the day less today's eating window. */
const goalHoursFor = (ctx) => 24 - Math.round(ctx.windowMsFor(ctx.todayKey) / HOUR);

/** Before the window: the dial leads Today, with the fast's two times under it. */
export function ringHero(ctx, lastBiteTs, times = null) {
  const state = fastingState(lastBiteTs, ctx.nowTs);
  return markStage(h('div', { class: 'ring-hero gap' },
    fastingRing(state, lastBiteTs, false, goalHoursFor(ctx)), ringLegend(), times), state, ctx.nowTs);
}

/**
 * The stage panel: the stage, what happens in it, and how far the goal and
 * the next stage are. After the window it holds a smaller dial and its times
 * as well; before it, the dial leads Today above.
 */
export function stagesSection(ctx, app, lastBiteTs, { withRing, times = null }) {
  if (!lastBiteTs) return null;
  const state = fastingState(lastBiteTs, ctx.nowTs);
  const goalHours = goalHoursFor(ctx);
  return markStage(h('section', { class: 'section', 'data-block': 'stages', 'data-stage': state.stage.key },
    withRing ? [fastingRing(state, lastBiteTs, true, goalHours), ringLegend(), times] : null,
    h('div', { class: withRing ? 'label gap-l' : 'label' }, state.stage.name),
    h('p', { class: 'gap-s' }, state.stage.text),
    ringLines(state, lastBiteTs, goalHours),
    h('div', { class: 'gap-s' }, button('About the stages', () => showStagesSheet(state.stage.key), { kind: 'secondary', name: 'about-stages' })),
  ), state, ctx.nowTs);
}

// The hours of each stage, short enough for the line across the sheet.
const SHORT_HOURS = { digesting: '0–4 h', settling: '4–12 h', switch: '12–24 h', ketones: '24–48 h', brain: '48–72 h', sparing: '72 h+' };

/**
 * The stages one at a time: all six along a line across the top, three to
 * a view, the one the fast is in now ringed in the sun's gold, and a card for each below,
 * each a shade deeper, from pale sand to dark rock. Swipe the line, the cards, or tap
 * a stage; the sheet opens on the stage the fast is in now.
 */
export function showStagesSheet(currentKey = null) {
  openSheet((api) => {
    const cards = h('ul', { class: 'stage-cards', 'data-testid': 'stage-list' }, STAGES.map((st) => h('li', {
      class: `stage-card s-${st.key}`,
      'data-stage': st.key,
    },
      h('div', { class: 'stage-card-head' },
        h('div', { class: 'label' }, st.range),
        st.key === currentKey ? h('span', { class: 'now-badge', 'data-testid': 'stage-now' }, 'Now') : null),
      h('h2', { class: 'h2' }, st.name),
      h('p', { class: 'gap-s' }, st.text))));
    const stops = STAGES.map((st) => h('button', {
      type: 'button',
      class: `stage-stop${st.key === currentKey ? ' now' : ''}`,
      'data-action': `stage-${st.key}`,
      'aria-label': `${st.name}, ${st.range}${st.key === currentKey ? ', now' : ''}`,
      onclick: () => show(STAGES.indexOf(st), true),
    },
      h('span', { class: `disc s-${st.key}` }, stageGlyph(st.key)),
      h('span', { class: 'name' }, st.name),
      h('span', { class: 'hrs' }, SHORT_HOURS[st.key])));
    // Three stages show at a time; the line swipes on its own, and follows the card shown.
    const line = h('div', { class: 'stage-line', role: 'group', 'aria-label': 'Stages', 'data-testid': 'stage-line' }, h('div', { class: 'stage-track' }, stops));
    const motion = (smooth) => (smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto');
    let marked = -1;
    const mark = (i, smooth = true) => {
      // A timer or a frame can outlive the sheet.
      if (!line.isConnected || !stops[i]) return;
      stops.forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
      if (i === marked) return;
      marked = i;
      const b = stops[i];
      line.scrollTo({ left: b.offsetLeft - (line.clientWidth - b.offsetWidth) / 2, behavior: motion(smooth) });
    };
    const step = () => (cards.children[1] ? cards.children[1].offsetLeft - cards.children[0].offsetLeft : cards.clientWidth);
    const shownCard = () => Math.max(0, Math.min(STAGES.length - 1, Math.round(cards.scrollLeft / step())));
    // While the cards glide to a tapped stage, the line waits for them rather than following each card passed.
    let target = null;
    let settle = 0;
    function show(i, smooth) {
      target = i;
      clearTimeout(settle);
      settle = setTimeout(() => { target = null; mark(shownCard()); }, 800);
      cards.scrollTo({ left: i * step(), behavior: motion(smooth) });
      marked = -1; // a tapped stage is centred even when it is the one marked
      mark(i, smooth);
    }
    // Swiping moves the mark along the line.
    let frame = 0;
    cards.addEventListener('scroll', () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = shownCard();
        if (target !== null && i !== target) return;
        target = null;
        mark(i);
      });
    }, { passive: true });
    const start = Math.max(0, STAGES.findIndex((st) => st.key === currentKey));
    stops.forEach((b, j) => b.setAttribute('aria-current', String(j === start)));
    // Open on the stage the fast is in, once the cards and the line have their width.
    requestAnimationFrame(() => show(start, false));
    return h('div', {},
      sheetHead(api, 'Fasting stages'),
      h('p', {}, 'Typical changes after your last bite, from human studies. Swipe the stages or the cards, or tap a stage.'),
      line,
      cards,
      h('p', { class: 'small quiet gap' }, VARIATION_NOTE),
      h('section', { class: 'section gap' },
        h('div', { class: 'label' }, 'Autophagy'),
        h('p', { class: 'gap-s', 'data-testid': 'autophagy-note' }, AUTOPHAGY_NOTE)),
      h('section', { class: 'section' },
        h('div', { class: 'label' }, 'Sources'),
        h('ol', { class: 'steps gap-s small' }, SOURCES.map((src) => h('li', {}, h('span', {}, src))))));
  }, { name: 'stages', label: 'Fasting stages' });
}
