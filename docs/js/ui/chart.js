// Weekly weight averages: one series, a recessive rock line with the latest
// week emphasised in gold and labelled. Solid hairline grid. A touch readout
// and a table view carry every value, so the chart never gates a number.

import { h, s } from './dom.js';
import { fmtDayMonth } from '../core/time.js';

const W = 340;
const H = 190;
const PAD = { top: 18, right: 46, bottom: 30, left: 38 };
const LINE = '#9C6832'; // --rock-500: recessive series
const ACCENT = '#F0B25C'; // --accent: the latest week only
const SURFACE = '#05060B'; // --bg: ring around markers
const GRID = 'rgba(224, 174, 91, 0.22)';

function niceStep(range) {
  const steps = [0.2, 0.5, 1, 2, 5, 10];
  return steps.find((st) => range / st <= 4) || 10;
}

/** points: [{ week, avg, n }] oldest first. */
export function weightChart(points) {
  const data = points.slice(-12);
  const readout = h('p', { class: 'small quiet chart-readout', 'aria-live': 'polite' }, 'Touch the chart to read a week.');
  if (!data.length) return h('div');

  let lo = Math.min(...data.map((p) => p.avg));
  let hi = Math.max(...data.map((p) => p.avg));
  if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;

  const grid = [];
  for (let v = lo; v <= hi + 1e-9; v += step) {
    const yy = y(v).toFixed(1);
    grid.push(s('line', { x1: PAD.left, x2: W - PAD.right, y1: yy, y2: yy, stroke: GRID, 'stroke-width': '1' }));
    grid.push(s('text', { x: PAD.left - 8, y: Number(yy) + 4, 'text-anchor': 'end' }, v.toFixed(step < 1 ? 1 : 0)));
  }

  const labelIdx = data.length <= 3 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const xLabels = [...new Set(labelIdx)].map((i) => s('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 && data.length > 1 ? 'start' : i === data.length - 1 && data.length > 1 ? 'end' : 'middle' }, fmtDayMonth(data[i].week)));

  const path = data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const lx = x(data.length - 1);
  const ly = y(last.avg);

  const marker = (i, p, latest) => {
    const size = latest ? 10 : 8;
    return s('rect', {
      x: (x(i) - size / 2).toFixed(1), y: (y(p.avg) - size / 2).toFixed(1), width: size, height: size,
      fill: latest ? ACCENT : LINE, stroke: SURFACE, 'stroke-width': '2', class: latest ? 'latest' : null,
    });
  };

  const cross = s('line', { y1: PAD.top, y2: H - PAD.bottom, stroke: 'rgba(224, 174, 91, 0.55)', 'stroke-width': '1', visibility: 'hidden' });
  const svg = s('svg', {
    class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0',
    'aria-label': `Weekly weight averages, ${data.length} ${data.length === 1 ? 'week' : 'weeks'}. Latest ${last.avg.toFixed(1)} kg, week of ${fmtDayMonth(last.week)}.`,
  },
    ...grid,
    ...xLabels,
    data.length > 1 ? s('path', { d: path, fill: 'none', stroke: LINE, 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }) : null,
    cross,
    ...data.map((p, i) => marker(i, p, i === data.length - 1)),
    s('text', { x: lx + 9, y: ly + 4, class: 'chart-end', fill: '#F6E7CB' }, last.avg.toFixed(1)),
  );

  // Touch and keyboard readout: snaps to the nearest week.
  let active = data.length - 1;
  const show = (i) => {
    active = Math.max(0, Math.min(data.length - 1, i));
    const p = data[active];
    cross.setAttribute('x1', x(active));
    cross.setAttribute('x2', x(active));
    cross.setAttribute('visibility', 'visible');
    readout.textContent = `Week of ${fmtDayMonth(p.week)}: ${p.avg.toFixed(1)} kg average of ${p.n} weigh-ins.`;
  };
  const nearest = (evt) => {
    const box = svg.getBoundingClientRect();
    const px = ((evt.clientX - box.left) / box.width) * W;
    let best = 0;
    data.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    return best;
  };
  svg.addEventListener('pointerdown', (e) => show(nearest(e)));
  svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) show(nearest(e)); });
  svg.addEventListener('focus', () => show(active));
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(active - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(active + 1); }
  });

  return h('div', { class: 'chart-wrap' }, svg, readout);
}

/** Table view of the same weekly averages. */
export function weightTable(points) {
  return h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Week of'), h('th', { scope: 'col' }, 'Average'), h('th', { scope: 'col' }, 'Weigh-ins'))),
    h('tbody', {}, [...points].reverse().map((p) => h('tr', {},
      h('td', {}, fmtDayMonth(p.week)), h('td', {}, `${p.avg.toFixed(1)} kg`), h('td', {}, String(p.n))))));
}
