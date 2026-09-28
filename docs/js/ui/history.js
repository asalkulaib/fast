// History: fast or feast hours per day, as bars or a line, over 7, 30 or
// 90 days. One series in recessive rock, missed days in clay and the
// selected day in gold; a solid 7-day trend line and a dashed average line
// on top; paused days shaded behind. A tap reads any day; a table view
// repeats the values.

import { h, s } from './dom.js';
import { button, choice } from './components.js';
import * as store from '../store.js';
import { HOUR, addDays, fmtDayMonth, fmtDayShort, fmtDuration, weekdayShort, keyParts } from '../core/time.js';
import { dailySeries, hourScale, rollingAverage, summarize } from '../core/history.js';
import { dunes } from './art.js';
import { header } from './shared.js';

const W = 340;
const HT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };
const MARK = '#9C6832'; // --rock-500: the series, recessive
const MISS = '#9E3B23'; // --clay: a missed day
const PICK = '#F0B25C'; // --accent: the selected day, gold leaf edged in ink
const INK = '#1E140C'; // --ink: the 7-day trend, the average (dashed) and edges
const BAND = '#D8BF93'; // --sand-300: a paused day
const SURFACE = '#E6D0A8'; // --bg: ring around markers
const GRID = 'rgba(42, 28, 16, 0.14)';

const METRICS = {
  fast: { key: 'fastMs', name: 'Fast', noun: 'fast', empty: 'Fasts appear here from the day after your first logged window.' },
  feast: { key: 'feastMs', name: 'Feast', noun: 'window', empty: 'Your eating windows appear here once you close one.' },
};

const FOR_REASON = { travel: ' for travel', illness: ' for illness', ramadan: ' for Ramadan' };

let selected = null; // the day the reader tapped, kept across redraws

function prefs(settings) {
  return {
    metric: METRICS[settings.historyMetric] ? settings.historyMetric : 'fast',
    chart: settings.historyChart === 'line' ? 'line' : 'bars',
    range: [7, 30, 90].includes(settings.historyRange) ? settings.historyRange : 30,
  };
}

/** A path through the values, broken where a day has none. */
function linePath(values, xc, y) {
  let d = '';
  values.forEach((v, i) => {
    if (v == null) return;
    d += `${d && values[i - 1] != null ? 'L' : 'M'}${xc(i).toFixed(1)} ${y(v).toFixed(1)} `;
  });
  return d.trim();
}

function chart({ series, trend, metric, kind, isMiss, avgMs, onPick }) {
  const key = METRICS[metric].key;
  const n = series.length;
  const values = series.map((d) => d[key]);
  const { step, top } = hourScale(Math.max(...values.filter((v) => v != null), HOUR));
  const plotW = W - PAD.left - PAD.right;
  const plotH = HT - PAD.top - PAD.bottom;
  const slot = plotW / n;
  const xc = (i) => PAD.left + slot * i + slot / 2;
  const y = (ms) => PAD.top + plotH * (1 - ms / (top * HOUR));
  const pickIdx = series.findIndex((d) => d.day === selected);

  // Paused days: a quiet band behind everything.
  const bands = series.map((d, i) => (d.paused
    ? s('rect', { x: (PAD.left + slot * i).toFixed(1), y: PAD.top, width: slot.toFixed(1), height: plotH, fill: BAND, 'data-paused': d.day })
    : null)).filter(Boolean);

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

  const colour = (i) => (i === pickIdx ? PICK : isMiss(series[i].day) ? MISS : MARK);
  const marks = [];
  const markers = [];
  if (kind === 'bars') {
    const gap = Math.min(2, slot * 0.3);
    const bw = Math.min(24, slot - gap);
    values.forEach((v, i) => {
      if (v == null) return;
      marks.push(s('rect', {
        x: (xc(i) - bw / 2).toFixed(1), y: y(v).toFixed(1), width: bw.toFixed(1), height: (y(0) - y(v)).toFixed(1),
        fill: colour(i), 'data-day': series[i].day, 'data-miss': isMiss(series[i].day) ? 'true' : null,
        stroke: i === pickIdx ? INK : null, 'stroke-width': i === pickIdx ? 1.5 : null,
      }));
    });
  } else {
    // A 2px line that breaks over days with no value; square markers when
    // they fit, and always for missed days and the selected one.
    const d = linePath(values, xc, y);
    if (d) marks.push(s('path', { d, fill: 'none', stroke: MARK, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    values.forEach((v, i) => {
      if (v == null) return;
      const pick = i === pickIdx;
      const miss = isMiss(series[i].day);
      if (!pick && !miss && n > 30) return;
      const size = pick ? 10 : 8;
      markers.push(s('rect', {
        x: (xc(i) - size / 2).toFixed(1), y: (y(v) - size / 2).toFixed(1), width: size, height: size,
        fill: colour(i), stroke: pick ? INK : SURFACE, 'stroke-width': pick ? 1.5 : 2, 'data-day': series[i].day, 'data-miss': miss ? 'true' : null,
      }));
    });
  }

  const trendD = linePath(trend, xc, y);
  const trendLine = trendD
    ? s('path', { d: trendD, fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-testid': 'trend-line' })
    : null;
  const avgLine = avgMs != null
    ? s('line', {
      x1: PAD.left, x2: W - PAD.right, y1: y(avgMs).toFixed(1), y2: y(avgMs).toFixed(1),
      stroke: INK, 'stroke-opacity': 0.6, 'stroke-width': 1.25, 'stroke-dasharray': '3 4', 'data-testid': 'avg-line',
    })
    : null;

  const svg = s('svg', {
    class: 'chart history-chart',
    viewBox: `0 0 ${W} ${HT}`,
    role: 'img',
    tabindex: '0',
    'data-testid': 'history-chart',
    'data-kind': kind,
    'aria-label': `${METRICS[metric].name} hours per day, ${n} days, with the 7-day trend and the average. Tap a day to read it.`,
  }, ...bands, ...grid, ...xLabels, ...marks, trendLine, avgLine, ...markers);

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

/** Which marks are on the chart, so identity never rests on colour alone. */
function legend({ anyMiss, anyTrend, anyPaused }) {
  const item = (kind, label) => h('span', { class: 'legend-item' }, h('span', { class: `swatch ${kind}`, 'aria-hidden': 'true' }), label);
  return h('div', { class: 'legend', 'data-testid': 'history-legend' },
    anyMiss ? item('miss', 'Miss') : null,
    anyTrend ? item('trend', '7-day trend') : null,
    item('avg', 'Average'),
    anyPaused ? item('paused', 'Paused') : null);
}

/** A duration that never breaks across lines ('3 h 31 min'). */
const whole = (ms) => fmtDuration(ms).replace(/ /g, ' ');

function readout(d, m, trendMs, miss) {
  if (!d) return '';
  const day = fmtDayShort(d.day);
  if (d.paused) return `${day}: paused${FOR_REASON[d.paused] || ''}.`;
  const v = d[m.key];
  const first = v != null ? `${day}: ${m.noun} ${whole(v)}${miss ? ', a miss' : ''}.` : `${day}: no ${m.noun} recorded.`;
  return trendMs != null ? `${first} 7-day trend ${whole(trendMs)}.` : first;
}

function table(series, trend, m, isMiss) {
  const rows = series.map((d, i) => ({ d, t: trend[i] })).reverse().filter(({ d }) => d[m.key] != null || d.paused);
  return h('table', { class: 'table', 'data-testid': 'history-table' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col' }, m.name), h('th', { scope: 'col' }, '7-day trend'))),
    h('tbody', {}, rows.map(({ d, t }) => h('tr', {},
      h('td', {}, `${fmtDayShort(d.day)}${isMiss(d.day) ? ', miss' : ''}`),
      h('td', {}, d.paused ? 'Paused' : fmtDuration(d[m.key])),
      h('td', {}, t != null && !d.paused ? fmtDuration(t) : '')))));
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
  const from = fromKey < ctx.startKey ? ctx.startKey : fromKey;
  // Six days before the range feed the trend at its start.
  const full = dailySeries(ctx, addDays(from, -6), ctx.todayKey);
  // No trend point on a paused day: the line breaks over the pause.
  const trend = rollingAverage(full, m.key).slice(6).map((t, i) => (full[i + 6].paused ? null : t));
  const series = full.slice(6);
  const sum = summarize(series, m.key);
  const isMiss = (day) => ctx.evaluate(day).result === 'miss';
  if (!series.some((d) => d.day === selected)) {
    const latest = [...series].reverse().find((d) => d[m.key] != null);
    selected = latest ? latest.day : null;
  }
  const pickIdx = series.findIndex((d) => d.day === selected);
  const pick = pickIdx >= 0 ? series[pickIdx] : null;
  const set = (values) => store.setSettings(values);

  const controls = h('section', { class: 'section', 'data-block': 'history-controls' },
    h('div', { class: 'btn-pair' },
      choice({ options: [{ value: 'fast', label: 'Fast' }, { value: 'feast', label: 'Feast' }], value: p.metric, cols: 2, name: 'history-metric', onChange: (v) => set({ historyMetric: v }) }),
      choice({ options: [{ value: 'bars', label: 'Bars' }, { value: 'line', label: 'Line' }], value: p.chart, cols: 2, name: 'history-chart', onChange: (v) => set({ historyChart: v }) })),
    h('div', { class: 'gap' },
      choice({ options: [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }], value: p.range, cols: 3, name: 'history-range', onChange: (v) => set({ historyRange: v }) })));

  const body = sum.count
    ? h('section', { class: 'section', 'data-block': 'history-chart' },
      chart({ series, trend, metric: p.metric, kind: p.chart, isMiss, avgMs: sum.avgMs, onPick: (day) => { selected = day; app.refresh(); } }),
      legend({ anyMiss: series.some((d) => d[m.key] != null && isMiss(d.day)), anyTrend: trend.some((t) => t != null), anyPaused: series.some((d) => d.paused) }),
      h('p', { class: 'small gap-s', 'data-testid': 'history-readout' }, readout(pick, m, pick ? trend[pickIdx] : null, pick ? isMiss(pick.day) : false)),
      pick ? h('div', {}, button('Open this day', () => app.go(`day/${pick.day}`), { kind: 'secondary', name: 'history-open-day' })) : null,
      app.ui.showHistoryTable ? h('div', { class: 'gap' }, table(series, trend, m, isMiss)) : null,
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
