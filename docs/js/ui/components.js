// Shared controls: rating scales, choices, the rolling 24-hour time wheel, fields.

import { h } from './dom.js';
import { minutesOfDay, now } from '../core/time.js';

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/**
 * Row of square tap targets. Selected value in gold.
 * opts: { n, value, onChange, label, low, high, start = 1 }
 */
export function scale({ n, value, onChange, label, low, high, start = 1, name }) {
  const labelId = nextId('scale');
  const short = n <= 5;
  const row = h('div', { class: short ? 'scale short' : 'scale', role: 'radiogroup', 'aria-labelledby': labelId });
  row.style.setProperty('--n', String(n));
  const buttons = [];
  for (let i = 0; i < n; i++) {
    const v = start + i;
    const b = h('button', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(v === value),
      'aria-label': `${v}`,
      dataset: { value: String(v), scale: name || '' },
      onclick: () => {
        for (const x of buttons) x.setAttribute('aria-checked', String(x === b));
        onChange(v);
      },
    }, String(v));
    buttons.push(b);
    row.append(b);
  }
  const wrap = h('div', { class: short ? 'scale-wrap short' : 'scale-wrap' },
    label ? h('div', { class: 'label field-label', id: labelId }, label) : null,
    row,
    low || high ? h('div', { class: 'scale-ends' }, h('span', {}, low || ''), h('span', {}, high || '')) : null,
  );
  wrap.style.setProperty('--n', String(n));
  return wrap;
}

/**
 * Grid of text options (one choice). options: [{ value, label }]
 */
export function choice({ options, value, onChange, label, cols = 3, name }) {
  const labelId = nextId('choice');
  const grid = h('div', { class: 'choice', role: 'radiogroup', 'aria-labelledby': label ? labelId : null });
  grid.style.setProperty('--cols', String(cols));
  const buttons = options.map((o) => {
    const b = h('button', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(o.value === value),
      dataset: { value: String(o.value), choice: name || '' },
      onclick: () => {
        for (const x of buttons) x.setAttribute('aria-checked', String(x === b));
        onChange(o.value);
      },
    }, o.label);
    return b;
  });
  grid.append(...buttons);
  return h('div', { class: 'choice-wrap' }, label ? h('div', { class: 'label field-label', id: labelId }, label) : null, grid);
}

// ---------- Rolling time wheel ----------

const ROW = 36; // px per row; five rows show, the middle one is selected

/**
 * One rolling column (hours or minutes). Scroll-snap does the rolling; the
 * value is committed when it comes to rest, or at once on a tap or arrow key.
 * Our own positioning never counts as a choice: only touch, wheel or keys do.
 */
function wheelColumn({ count, index, label, part, onSettle }) {
  const col = h('div', {
    class: 'wheel-col',
    tabindex: '0',
    role: 'spinbutton',
    'aria-label': label,
    'aria-valuemin': '0',
    'aria-valuemax': String(count - 1),
    'data-part': part,
  });
  const items = Array.from({ length: count }, (_, i) => h('div', { class: 'wheel-item', 'data-value': String(i), 'aria-hidden': 'true' }, String(i).padStart(2, '0')));
  col.append(h('div', { class: 'wheel-pad', 'aria-hidden': 'true' }), ...items, h('div', { class: 'wheel-pad', 'aria-hidden': 'true' }));

  let current = index;
  let shown = -1;
  let touched = false;
  let timer = null;
  const clamp = (i) => Math.max(0, Math.min(count - 1, i));
  const nearest = () => clamp(Math.round(col.scrollTop / ROW));
  const paint = (i) => {
    if (i === shown) return;
    for (const j of [shown - 2, shown - 1, shown, shown + 1, shown + 2]) if (items[j]) items[j].className = 'wheel-item';
    for (const [j, cls] of [[i - 2, 'far'], [i - 1, 'near'], [i, 'on'], [i + 1, 'near'], [i + 2, 'far']]) {
      if (items[j]) items[j].className = `wheel-item ${cls}`;
    }
    shown = i;
    col.setAttribute('aria-valuenow', String(i));
    col.setAttribute('aria-valuetext', String(i).padStart(2, '0'));
  };
  const choose = (i) => {
    paint(i);
    if (i !== current) {
      current = i;
      onSettle();
    }
  };
  const settle = () => {
    clearTimeout(timer);
    timer = null;
    // Saving redraws the screen; a column already replaced has no position to read.
    if (touched && col.isConnected) choose(nearest());
  };
  col.addEventListener('scroll', () => {
    if (!col.isConnected) return;
    paint(nearest());
    clearTimeout(timer);
    timer = setTimeout(settle, 140);
  }, { passive: true });
  col.addEventListener('scrollend', settle);
  for (const type of ['pointerdown', 'touchstart', 'wheel']) col.addEventListener(type, () => { touched = true; }, { passive: true });
  col.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    touched = true;
    const i = clamp(shown + (e.key === 'ArrowDown' ? 1 : -1));
    col.scrollTop = i * ROW;
    choose(i);
  });
  items.forEach((it, j) => it.addEventListener('click', () => {
    touched = true;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    col.scrollTo({ top: j * ROW, behavior: reduce ? 'auto' : 'smooth' });
    choose(j);
  }));

  // Position once the column is on screen and has a size.
  const place = () => {
    col.scrollTop = current * ROW;
    paint(current);
  };
  const ro = new ResizeObserver(() => {
    if (col.clientHeight > 0) {
      if (!touched) place();
      ro.disconnect();
    }
  });
  ro.observe(col);
  paint(current);

  return {
    col,
    index: () => current,
    set(i) {
      current = clamp(i);
      touched = false;
      place();
    },
  };
}

/**
 * 24-hour time wheel: hours and minutes that roll, like the iPhone clock,
 * always in 24-hour form. onChange(minutes) fires when a new time settles.
 * minutes may be null (not set yet): the wheel then shows `fallback` quietly
 * until it is rolled. With allowUnset, a Clear button sets it back to null.
 */
export function timeField({ minutes, onChange, label, hint, name, fallback = null, allowUnset = false }) {
  const id = nextId('time');
  let value = minutes;
  const start = minutes ?? fallback ?? minutesOfDay(now());
  const wheel = h('div', { class: `wheel${value == null ? ' unset' : ''}`, role: 'group', 'aria-labelledby': label ? id : null, 'aria-label': label ? null : 'Time' });
  const hintEl = h('div', { class: 'field-hint' }, value == null ? (hint || 'Roll to set.') : hint || '');
  const commit = () => {
    const m = hours.index() * 60 + mins.index();
    wheel.classList.remove('unset');
    hintEl.textContent = hint || '';
    if (clearBtn) clearBtn.hidden = false;
    if (m !== value) {
      value = m;
      onChange(m);
    }
  };
  const hours = wheelColumn({ count: 24, index: Math.floor(start / 60), label: 'Hours', part: 'hour', onSettle: commit });
  const mins = wheelColumn({ count: 60, index: start % 60, label: 'Minutes', part: 'minute', onSettle: commit });
  wheel.append(hours.col, h('div', { class: 'wheel-sep', 'aria-hidden': 'true' }, ':'), mins.col, h('div', { class: 'wheel-lens', 'aria-hidden': 'true' }));

  const clearBtn = allowUnset
    ? h('button', {
      type: 'button',
      class: 'btn-2',
      'data-action': `clear-${name || 'time'}`,
      hidden: value == null,
      onclick: () => {
        value = null;
        wheel.classList.add('unset');
        hintEl.textContent = hint || 'Roll to set.';
        clearBtn.hidden = true;
        onChange(null);
      },
    }, 'Clear')
    : null;

  const wrap = h('div', { class: 'time-wrap', dataset: { time: name || '' } },
    label ? h('div', { class: 'label field-label', id }, label) : null,
    wheel,
    h('div', { class: 'time-foot' }, hintEl, clearBtn),
  );
  wrap.set = (m) => {
    value = m;
    if (m == null) {
      wheel.classList.add('unset');
      return;
    }
    wheel.classList.remove('unset');
    hours.set(Math.floor(m / 60));
    mins.set(m % 60);
  };
  Object.defineProperty(wrap, 'value', { get: () => value });
  return wrap;
}

export function textField({ value, onInput, label, placeholder, name }) {
  const id = nextId('text');
  const input = h('input', {
    id,
    class: 'field',
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'sentences',
    placeholder: placeholder || '',
    maxlength: '60',
    dataset: { field: name || '' },
    value: value || '',
    oninput: () => onInput(input.value.trim()),
  });
  return h('div', { class: 'text-wrap' }, label ? h('label', { class: 'label field-label', for: id }, label) : null, input);
}

export function button(label, onClick, { kind = 'primary', block = false, big = false, name, disabled = false } = {}) {
  const cls = kind === 'secondary' ? 'btn-2' : ['btn', block ? 'block' : '', big ? 'big' : ''].filter(Boolean).join(' ');
  // While an action is still saving, further taps are ignored (no double
  // records). The action itself starts inside the tap, so iOS still allows
  // the clipboard and the share sheet.
  let busy = false;
  const run = (e) => {
    if (busy) return;
    const result = onClick(e);
    if (result && typeof result.then === 'function') {
      busy = true;
      b.setAttribute('aria-busy', 'true');
      result.finally(() => {
        busy = false;
        b.removeAttribute('aria-busy');
      });
    }
  };
  const b = h('button', { type: 'button', class: cls, dataset: { action: name || '' }, disabled, onclick: run }, label);
  if (kind === 'primary') {
    // Keep the pressed fill visible briefly on touch devices.
    b.addEventListener('touchstart', () => b.classList.add('pressed'), { passive: true });
    const off = () => setTimeout(() => b.classList.remove('pressed'), 180);
    b.addEventListener('touchend', off);
    b.addEventListener('touchcancel', off);
  }
  return b;
}

export const TRIGGER_OPTIONS = [
  { value: 'hunger', label: 'Hunger' },
  { value: 'boredom', label: 'Boredom' },
  { value: 'social', label: 'Social' },
  { value: 'stress', label: 'Stress' },
  { value: 'tired', label: 'Tired' },
  { value: 'other', label: 'Other' },
];

export const STOP_OPTIONS = [
  { value: 'before_full', label: 'Before full' },
  { value: 'full', label: 'Full' },
  { value: 'stuffed', label: 'Stuffed' },
];

export const STOP_TEXT = { before_full: 'before full', full: 'full', stuffed: 'stuffed' };

export const TRAINING_OPTIONS = [
  { value: 'weights', label: 'Weights' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'other', label: 'Other' },
];

export const OUTCOME_TEXT = {
  held: 'Held',
  opened_early: 'Opened the window early',
  ate_little: 'Ate a little outside the window',
  ate_outside: 'Ate outside the window',
};
