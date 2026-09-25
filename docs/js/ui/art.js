// Layered flat silhouettes of dunes and rock. Farther layers sit closer to the
// night colour so the scene dissolves into the background without gradients.
// Used on Today and on empty states only.

import { s } from './dom.js';

export function dunes({ label = '' } = {}) {
  return s('svg', {
    class: 'dunes',
    viewBox: '0 0 390 168',
    preserveAspectRatio: 'xMidYMax slice',
    role: label ? 'img' : 'presentation',
    'aria-hidden': label ? null : 'true',
    'aria-label': label || null,
    focusable: 'false',
  },
    // Far rock outcrop and ridge, nearly night.
    s('path', { fill: '#4B2E14', 'fill-opacity': '0.42', d: 'M0 96 C38 88 74 84 112 90 C150 96 186 102 222 96 L240 92 L248 78 L256 73 L292 72 L301 78 L309 90 C334 86 362 82 390 86 L390 168 L0 168 Z' }),
    // Middle dune.
    s('path', { fill: '#5E3B18', 'fill-opacity': '0.72', d: 'M0 114 C46 102 96 100 146 110 C196 120 240 124 286 112 C322 103 356 100 390 106 L390 168 L0 168 Z' }),
    // Lit dune catching the last light.
    s('path', { fill: '#9C6832', 'fill-opacity': '0.62', d: 'M0 132 C54 120 112 118 164 128 C212 137 252 141 298 130 C334 122 362 120 390 124 L390 168 L0 168 Z' }),
    // Thin crest of light on the near dune.
    s('path', { fill: '#C58E50', 'fill-opacity': '0.8', d: 'M96 139 C140 134 186 137 224 145 C252 150 282 150 312 144 C284 152 252 153 222 148 C186 141 142 138 96 139 Z' }),
    // Near dune, darkest and closest to the page.
    s('path', { fill: '#4B2E14', d: 'M0 148 C60 136 120 136 176 144 C226 151 276 154 330 146 C352 143 372 141 390 142 L390 168 L0 168 Z' }),
  );
}
