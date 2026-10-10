// The scenery at the foot of Today and on empty screens: the Edge of the
// World on the Tuwaiq escarpment near Riyadh, drawn in docs/js/ui/scenery.js,
// in the light of the time of day.

import { s } from './dom.js';
import { tuwaiqScene } from './scenery.js';

/** phase: one of DAY_PHASES (docs/js/core/daylight.js). */
export function scenery({ phase = 'midday', label = '' } = {}) {
  const svg = tuwaiqScene(s, phase, { label });
  svg.dataset.phase = phase;
  return svg;
}
