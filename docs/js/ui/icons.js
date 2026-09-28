// Stage icons: thin line drawings on a 24 x 24 grid, stroked in the current
// text colour so CSS decides quiet or ink; the current one sits on a disc of
// gold leaf. Never emoji.

import { s } from './dom.js';

const PATHS = {
  // Digesting: a plate beside a fork.
  digesting: [
    'M3.5 3.5 V8 C3.5 9.4 4.4 10.2 5.5 10.2 C6.6 10.2 7.5 9.4 7.5 8 V3.5',
    'M5.5 3.5 V8',
    'M5.5 10.2 V20.5',
    'M14.5 5.5 A6.5 6.5 0 1 1 14.49 5.5 Z',
    'M14.5 8.5 A3.5 3.5 0 1 1 14.49 8.5 Z',
  ],
  // Blood sugar settles: a drop with a level line.
  settling: [
    'M12 3 C12 3 5.5 10.2 5.5 14.5 A6.5 6.5 0 0 0 18.5 14.5 C18.5 10.2 12 3 12 3 Z',
    'M8.5 15.5 H15.5',
  ],
  // Metabolic switch: a flame.
  switch: [
    'M12 2.8 C12.6 6.2 17.6 8.8 17.6 14.4 A5.6 5.6 0 0 1 6.4 14.4 C6.4 11.4 8.1 9.6 9.2 8.4 C9.3 10.1 10.1 11.2 11 11.6 C10.4 8.2 11.2 5.2 12 2.8 Z',
    'M12 13.2 C12.4 14.6 14.2 15.4 14.2 17.4 A2.2 2.2 0 0 1 9.8 17.4 C9.8 15.8 11.4 15 12 13.2 Z',
  ],
  // Ketones climbing: a bolt, energy from fat.
  ketones: [
    'M13.5 2.5 L5.5 13.5 H11.5 L10.5 21.5 L18.5 10 H12.5 Z',
  ],
};

/** An icon group centred on (x, y), drawn at size px. */
export function stageIcon(key, { x = 12, y = 12, size = 24, current = false } = {}) {
  const k = size / 24;
  return s('g', {
    class: current ? 'stage-icon now' : 'stage-icon',
    transform: `translate(${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}) scale(${k.toFixed(3)})`,
    'data-stage-icon': key,
    'aria-hidden': 'true',
  }, current ? s('circle', { class: 'leaf', cx: 12, cy: 12, r: 14 }) : null, ...PATHS[key].map((d) => s('path', { d })));
}
