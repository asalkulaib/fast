// History: fast or feast hours per day, as bars or a line, over 7, 30 or
// 90 days. One series: recessive rock marks, the selected day in gold,
// solid hairline grid. A tap reads any day; a table view repeats the values.

import { h, s } from './dom.js';
import { button, choice } from './components.js';
import * as store from '../store.js';
import { HOUR, addDays, fmtDayMonth, fmtDayShort, fmtDuration, weekdayShort, keyParts } from '../core/time.js';
import { dailySeries, hourScale, summarize } from '../core/history.js';
import { dunes } from './art.js';
import { header } from './shared.js';

const W = 340;
const HT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };
const MARK = '#9C6832'; // --rock-500: the series, recessive
const PICK = '#F0B25C'; // --accent: the selected day
const SURFACE = '#05060B'; // --bg: ring around markers
const GRID = 'rgba(224, 174, 91, 0.22)';

const METRICS = {
  fast: { key: 'fastMs', name: 'Fast', noun: 'fast', empty: 'Fasts appear here from the day after your first logged window.' },
  feast: { key: 'feastMs', name: 'Feast', noun: 'window', empty: 'Your eating windows appear here once you close one.' },
};

let selected = null; // the day the reader tapped, kept across redraws

function prefs(settings) {
  return {
    metric: METRICS[settings.historyMetric] ? settings.historyMetric : 'fast',
    chart: settings.historyChart === 'line' ? 'line' : 'bars',
    range: [7, 30, 90].includes(settings.historyRange) ? settings.historyRange : 30,
  };
}

function chart(series, metric, kind, onPick) {
  const key = METRICS[metric].key;
  const n = series.length;
  const values = series.map((d) => d[key]);
  const { step, top } = hourScale(Math.max(...values.filter((v) => v != null), HOUR));
  const plotW = W - PAD.left - PAD.right;
  const plotH = HT - PAD.top - PAD.bottom;
  const slot = plotW / n;
  const xc = (i) => PAD.left + slot * i + slot / 2;
  const y = (ms) => PAD.top + plotH * (1 - ms / (top * HOUR));

  const grid = [];
  for (let v = 0; v <= top; v += step) {
    const yy = y(v * HOUR).toFixed(1);
    grid.push(s('line', { x1: PAD.left, x2: W - PAD.right, y1: yy, y2: yy, stroke: GRID, 'stroke-width': 1 }));
    grid.push(s('text', { x: PAD.left - 6, y: Number(yy) + 4, 'text-anchor': 'end' }, v === top ? `${v} h` : String(v)));
  }

  const labelIdx = n <= 7 ? series.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const xLabels = labelIdx.map((i) => {
    const d = series[i].day;
    const text = n <= 7 ? `${weekdayShort(d).slice(0, 2)} ${keyParts(d).d}` : fmtDayMonth(d);
    const anchor = n <= 7 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    const x = n <= 7 ? xc(i) : i === 0 ? PAD.left : i === n - 1 ? W - PAD.right : xc(i);
    return s('text', { x, y: HT - 8, 'text-anchor': anchor }, text);
  });

  const pickIdx = series.findIndex((d) => d.day === selected);
  const marks = [];
  if (kind === 'bars') {
    const gap = Math.min(2, slot * 0.3);
    const bw = Math.min(24, slot - gap);
    values.forEach((v, i) => {
      if (v == null) return;
      marks.push(s('rect', {
        x: (xc(i) - bw / 2).toFixed(1), y: y(v).toFixed(1), width: bw.toFixed(1), height: (y(0) - y(v)).toFixed(1),
        fill: i === pickIdx ? PICK : MARK, 'data-day': series[i].day,
      }));
    });
  } else {
    // A 2px line that breaks over days with no value; square markers when they fit.
    let d = '';
    values.forEach((v, i) => {
      if (v == null) return;
      d += `${d && values[i - 1] != null ? 'L' : 'M'}${xc(i).toFixed(1)} ${y(v).toFixed(1)} `;
    });
    if (d) marks.push(s('path', { d: d.trim(), fill: 'none', stroke: MARK, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    values.forEach((v, i) => {
      if (v == null) return;
      const pick = i === pickIdx;
      if (!pick && n > 30) return;
      const size = pick ? 10 : 8;
      marks.push(s('rect', {
        x: (xc(i) - size / 2).toFixed(1), y: (y(v) - size / 2).toFixed(1), width: size, height: size,
        fill: pick ? PICK : MARK, stroke: SURFACE, 'stroke-width': 2, 'data-day': series[i].day,
      }));
    });
  }

  const svg = s('svg', {
    class: 'chart history-chart',
    viewBox: `0 0 ${W} ${HT}`,
    role: 'img',
    tabindex: '0',
    'data-testid': 'history-chart',
    'data-kind': kind,
    'aria-label': `${METRICS[metric].name} hours per day, ${n} days. Tap a day to read it.`,
  }, ...grid, ...xLabels, ...marks);

  const nearest = (evt) => {
    const box = svg.getBoundingClientRect();
    const px = ((evt.clientX - box.left) / box.width) * W;
    return Math.max(0, Math.min(n - 1, Math.floor((px - PAD.left) / slot)));
  };
  svg.addEventListener('pointerdown', (e) => onPick(series[nearest(e)].day));
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = pickIdx < 0 ? n - 1 : Math.max(0, Math.min(n - 1, pickIdx + (e.key === 'ArrowRight' ? 1 : -1)));
    onPick(series[i].day);
  });
  return svg;
}

function table(series, metric) {
  const key = METRICS[metric].key;
  return h('table', { class: 'table', 'data-testid': 'history-table' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col' }, METRICS[metric].name))),
    h('tbody', {}, [...series].reverse().filter((d) => d[key] != null).map((d) => h('tr', {},
      h('td', {}, fmtDayShort(d.day)), h('td', {}, fmtDuration(d[key]))))));
}

function summaryLine(sum, m, range) {
  if (!sum.count) return `Nothing yet in the last ${range} days.`;
  const avg = `Average ${m.noun} ${fmtDuration(sum.avgMs)}`;
  return sum.count === range ? `${avg} over the last ${range} days.` : `${avg}, from ${sum.count} of the last ${range} days.`;
}

export function renderHistory(ctx, app) {
  const p = prefs(ctx.settings);
  const m = METRICS[p.metric];
  const fromKey = addDays(ctx.todayKey, -(p.range - 1));
  const series = dailySeries(ctx, fromKey < ctx.startKey ? ctx.startKey : fromKey, ctx.todayKey);
  const sum = summarize(series, m.key);
  if (!series.some((d) => d.day === selected && d[m.key] != null)) {
    const latest = [...series].reverse().find((d) => d[m.key] != null);
    selected = latest ? latest.day : null;
  }
  const pick = series.find((d) => d.day === selected);
  const set = (values) => store.setSettings(values);

  const controls = h('section', { class: 'section', 'data-block': 'history-controls' },
    h('div', { class: 'btn-pair' },
      choice({ options: [{ value: 'fast', label: 'Fast' }, { value: 'feast', label: 'Feast' }], value: p.metric, cols: 2, name: 'history-metric', onChange: (v) => set({ historyMetric: v }) }),
      choice({ options: [{ value: 'bars', label: 'Bars' }, { value: 'line', label: 'Line' }], value: p.chart, cols: 2, name: 'history-chart', onChange: (v) => set({ historyChart: v }) })),
    h('div', { class: 'gap' },
      choice({ options: [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }], value: p.range, cols: 3, name: 'history-range', onChange: (v) => set({ historyRange: v }) })));

  const body = sum.count
    ? h('section', { class: 'section', 'data-block': 'history-chart' },
      chart(series, p.metric, p.chart, (day) => { selected = day; app.refresh(); }),
      h('p', { class: 'small gap-s', 'data-testid': 'history-readout' },
        pick && pick[m.key] != null ? `${fmtDayShort(pick.day)}: ${m.noun} ${fmtDuration(pick[m.key])}.` : ''),
      pick ? h('div', {}, button('Open this day', () => app.go(`day/${pick.day}`), { kind: 'secondary', name: 'history-open-day' })) : null,
      app.ui.showHistoryTable ? h('div', { class: 'gap' }, table(series, p.metric)) : null,
      button(app.ui.showHistoryTable ? 'Hide the table' : 'Show as a table', () => { app.ui.showHistoryTable = !app.ui.showHistoryTable; app.refresh(); }, { kind: 'secondary', name: 'history-toggle-table' }))
    : h('section', { class: 'section empty' }, h('p', { class: 'quiet' }, m.empty), dunes());

  return h('div', { class: 'history', 'data-metric': p.metric },
    header(ctx, app, { title: 'History' }),
    h('section', { class: 'section strong' },
      h('h1', { class: 'display' }, p.metric === 'fast' ? 'Fasts' : 'Eating windows'),
      h('p', { class: 'gap', 'data-testid': 'history-summary' }, summaryLine(sum, m, p.range))),
    controls,
    body,
  );
}
