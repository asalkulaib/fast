// Tiny DOM helpers. No framework.

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, props) {
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'live') el.__live = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value' && 'value' in el) el.value = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** h('p', { class: 'quiet' }, 'text', h('span', ...)) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, children);
  return el;
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props);
  append(el, children);
  return el;
}

/** The single highlight: a word or figure in gold. */
export const hl = (text) => h('span', { class: 'hl' }, text);

/**
 * A text node whose content is recomputed on every tick.
 * fn(nowTs) -> string
 */
export function live(tag, props, fn) {
  const el = h(tag, props);
  el.__live = fn;
  el.textContent = fn(Date.now());
  return el;
}

/** Recomputes every live element under root. */
export function updateLive(root, nowTs) {
  for (const el of root.querySelectorAll('*')) {
    if (typeof el.__live === 'function') {
      const text = el.__live(nowTs);
      if (el.textContent !== text) el.textContent = text;
    }
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
}

/** Soft fade in (250 to 400 ms, ease-out). */
export function fadeIn(el) {
  el.classList.remove('fade-out');
  el.classList.add('fade-in');
  return el;
}

export function fadeOut(el) {
  return new Promise((resolve) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return resolve();
    el.classList.remove('fade-in');
    el.classList.add('fade-out');
    const done = () => resolve();
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 400);
  });
}
