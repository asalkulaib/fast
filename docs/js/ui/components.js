// Shared controls: rating scales, choices, the 24-hour time field, fields.

import { h } from './dom.js';
import { fmtMinutes, parseClock } from '../core/time.js';

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

/**
 * 24-hour time field (HH:MM). Always 24-hour, whatever the phone's setting.
 * onChange(minutes) fires with a valid time; invalid input restores the last value.
 */
export function timeField({ minutes, onChange, label, hint, name }) {
  const id = nextId('time');
  let current = minutes;
  const input = h('input', {
    id,
    class: 'field time',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    maxlength: '5',
    placeholder: 'HH:MM',
    'aria-label': label || 'Time',
    dataset: { time: name || '' },
    value: current == null ? '' : fmtMinutes(current),
  });
  const hintEl = h('span', { class: 'field-hint' }, hint || '');
  const commit = () => {
    const parsed = parseClock(input.value.replace(/[^\d:.]/g, ''));
    if (parsed == null) {
      input.value = current == null ? '' : fmtMinutes(current);
      if (input.value !== '' || current != null) hintEl.textContent = 'Use 24-hour time, like 17:30.';
      return;
    }
    input.value = fmtMinutes(parsed);
    hintEl.textContent = hint || '';
    if (parsed !== current) {
      current = parsed;
      onChange(parsed);
    }
  };
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    if (!input.value.includes(':') && digits.length === 4) input.value = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  });
  input.addEventListener('change', commit);
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
  input.addEventListener('focus', () => input.select());
  const wrap = h('div', { class: 'time-wrap' },
    label ? h('label', { class: 'label field-label', for: id }, label) : null,
    h('div', { class: 'time-row' }, input, hintEl),
  );
  wrap.set = (m) => {
    current = m;
    input.value = m == null ? '' : fmtMinutes(m);
  };
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
