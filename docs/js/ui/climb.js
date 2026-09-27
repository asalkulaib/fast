// Jebel Uhud on Today: two climbers, each on its own path up the mountain.
// Flat silhouettes in the rock tones. The climbers on their way are in gold
// (fast) and cream (fullness); those who reached the summit stay there,
// muted, a record of every completed climb.

import { h, s } from './dom.js';
import { SUMMIT, climbers } from '../core/climb.js';

const W = 340;
const HT = 196;
const ROCK = '#4B2E14'; // --rock-700
const FACE = '#5E3B18'; // --sand-600: the sunlit side
const TRAIL = 'rgba(224, 174, 91, 0.35)'; // a quiet hairline
const COLOUR = {
  fast: { on: '#F0B25C', done: '#C58E50' }, // --accent, --rock-400
  fullness: { on: '#E4D2B2', done: '#A9957B' }, // --text-body, --text-quiet
};

// The mountain, symmetric, with a small summit plateau at y 40.
const OUTLINE = [[0, 196], [16, 184], [34, 176], [52, 164], [70, 156], [86, 140], [102, 130], [118, 110], [132, 94], [142, 74], [150, 48],
  [156, 44], [184, 44], [190, 48], [198, 74], [208, 94], [222, 110], [238, 130], [254, 140], [270, 156], [288, 164], [306, 176], [324, 184], [340, 190], [340, 196]];
const SUNLIT = [[0, 196], [16, 184], [34, 176], [52, 164], [70, 156], [86, 140], [102, 130], [118, 110], [132, 94], [142, 74], [150, 48],
  [156, 44], [170, 44], [162, 74], [150, 104], [134, 132], [110, 160], [80, 182], [56, 196]];
// Two switchback trails from the foot to the summit: fast on the left, fullness on the right.
const LEFT = [[96, 194], [140, 178], [110, 164], [150, 150], [124, 136], [156, 122], [136, 108], [160, 94], [148, 82], [164, 68], [156, 56], [170, 44]];
const PATHS = { fast: LEFT, fullness: LEFT.map(([x, y]) => [W - x, y]) };

const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ');

/** The point a fraction of the way along a trail, and the trail walked so far. */
function along(points, fraction) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let left = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, fraction));
  const walked = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const d = lengths[i - 1];
    if (left <= d) {
      const t = d ? left / d : 0;
      const at = [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
      walked.push(at);
      return { at, walked };
    }
    left -= d;
    walked.push(points[i]);
  }
  return { at: points[points.length - 1], walked };
}

/**
 * A climber standing at (x, y): a robed figure. The fast climber carries a
 * pennant; the fullness climber a small bowl.
 */
function figure(kind, [x, y], { done = false, scale = 1 } = {}) {
  const fill = COLOUR[kind][done ? 'done' : 'on'];
  const parts = [s('circle', { cx: 0, cy: -14, r: 3, fill }), s('path', { d: 'M-4 0 L0 -10 L4 0 Z', fill })];
  if (kind === 'fast') {
    parts.push(s('line', { x1: 5, y1: 0, x2: 5, y2: -19, stroke: fill, 'stroke-width': 1.2 }));
    parts.push(s('path', { d: 'M5 -19 L12 -16.5 L5 -14 Z', fill }));
  } else {
    parts.push(s('path', { d: 'M3 -9 A4 4 0 0 0 11 -9 Z', fill }));
  }
  return s('g', {
    transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`,
    class: done ? 'summiteer' : 'climber',
    'data-climber': kind,
    stroke: '#05060B',
    'stroke-width': 0.8,
    'paint-order': 'stroke',
  }, ...parts);
}

const summits = (n) => `${n} ${n === 1 ? 'summit' : 'summits'}`;
const NAME = { fast: 'Fast climber', fullness: 'Fullness climber' };

export function climbSection(ctx) {
  const c = climbers(ctx);
  const shown = ['fast', 'fullness'].filter((k) => c[k].on);
  if (!shown.length) return null;

  const trails = [];
  const crowd = [];
  const walkers = [];
  for (const k of shown) {
    const { at, walked } = along(PATHS[k], c[k].step / SUMMIT);
    trails.push(s('polyline', { points: pts(PATHS[k]), fill: 'none', stroke: TRAIL, 'stroke-width': 1, 'stroke-dasharray': '2 3' }));
    if (walked.length > 1) trails.push(s('polyline', { points: pts(walked), fill: 'none', stroke: COLOUR[k].on, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
    // Those who made it stand on the summit, fast to the left, fullness to the right.
    const side = k === 'fast' ? -1 : 1;
    for (let i = 0; i < Math.min(c[k].summits, 3); i++) crowd.push(figure(k, [170 + side * (5 + i * 7), 44], { done: true, scale: 0.75 }));
    walkers.push(figure(k, at));
  }

  const label = shown.map((k) => `${NAME[k]} on step ${c[k].step} of ${SUMMIT}, ${summits(c[k].summits)}`).join('. ');
  const svg = s('svg', { class: 'uhud', viewBox: `0 0 ${W} ${HT}`, role: 'img', 'aria-label': `Jebel Uhud. ${label}.`, 'data-testid': 'uhud' },
    s('polygon', { points: pts(OUTLINE), fill: ROCK }),
    s('polygon', { points: pts(SUNLIT), fill: FACE }),
    ...trails, ...crowd, ...walkers);

  const key = (k) => s('svg', { class: 'climber-key', viewBox: '-7 -22 20 24', 'aria-hidden': 'true' }, figure(k, [0, 0]));
  const tally = shown.map((k) => `${k === 'fast' ? 'Fasts' : 'Fullness'}: ${summits(c[k].summits)}`).join(' · ');
  const steps = [c.fast.on ? 'each successful day' : null, c.fullness.on ? 'each day left wanting' : null].filter(Boolean).join(', and ');
  return h('section', { class: 'section', 'data-block': 'climb' },
    h('div', { class: 'label' }, 'Jebel Uhud'),
    h('div', { class: 'gap-s' }, svg),
    h('div', { class: 'gap-s' }, shown.map((k) => h('div', { class: 'stat', 'data-testid': `climb-${k}` },
      h('span', { class: 'climber-name' }, key(k), NAME[k]),
      h('span', { class: 'stat-value' }, `${c[k].step} of ${SUMMIT}`)))),
    h('p', { class: 'gap-s', 'data-testid': 'summits' }, tally),
    h('p', { class: 'small quiet gap-s' }, `A step for ${steps}; ${SUMMIT} steps to the summit. A missed day holds, and nothing slips back.`));
}
