// Scenery for Fast, as a flat screen print with fine rock lines (after the WPA
// park posters, Maynard Dixon, Ed Mell and Hiroshige).
//   tuwaiqScene(s, phase): the Edge of the World (Jebel Fihrayn) on the Tuwaiq
//     escarpment, at the foot of Today. We stand below a prow and look south
//     along the cliff: flat-topped prows step away to the right, each with a
//     sheer limestone wall over a concave scree apron, above the pale plain.
//   hismaGround(s, phase): the Hisma near Tabuk under the dial's sun: two
//     fluted, domed jebels, a low frieze of far domes, red sand ramps, and a
//     mushroom rock on a slender stem after Umm Sarhej.
// Geometry is fixed (seeded PRNG); each phase of the day only swaps colours and
// which side of every rock is lit. East is on the left: morning light comes
// from the left, afternoon light from the right, the moon from the west.

const K = {
  p2: '#F7EEDC', p1: '#F1E3C7', pg: '#E6D0A8', s3: '#D8BF93', s4: '#C9A26C',
  r4: '#C58E50', r5: '#9C6832', mg: '#8C7556', q: '#5F4A31',
  s6: '#5E3B18', r7: '#4B2E14', bd: '#33241A', ru: '#2A1C10', ink: '#1E140C',
};
// Faint hatching, each alpha written out so the app's palette test can read it.
const H20 = 'rgba(42, 28, 16, 0.2)';
const H25 = 'rgba(42, 28, 16, 0.25)';
const H30 = 'rgba(42, 28, 16, 0.3)';

// ---------- small helpers ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const n = (v) => { const r = Math.round(v * 10) / 10; return String(Object.is(r, -0) ? 0 : r); };
const pt = (p) => `${n(p[0])} ${n(p[1])}`;
// Paths are written as relative moves in tenths of a unit, so they stay small.
const fmt = (t) => { const a = Math.abs(t), s = a % 10 ? (a < 10 ? '.' + a : Math.floor(a / 10) + '.' + (a % 10)) : String(a / 10); return (t < 0 ? '-' : '') + s; };
const pair = (dx, dy, lead) => { const sx = fmt(dx), sy = fmt(dy); return (lead && sx[0] !== '-' ? ' ' : '') + sx + (sy[0] === '-' ? '' : ' ') + sy; };
function rel(a, close) {
  if (a.length < 2) return '';
  let px = Math.round(a[0][0] * 10), py = Math.round(a[0][1] * 10);
  let d = 'M' + fmt(px) + ' ' + fmt(py) + 'l';
  let lead = false;
  for (let i = 1; i < a.length; i++) {
    const x = Math.round(a[i][0] * 10), y = Math.round(a[i][1] * 10);
    if (x === px && y === py) continue;
    d += pair(x - px, y - py, lead);
    lead = true; px = x; py = y;
  }
  return lead ? d + (close ? 'z' : '') : '';
}
const poly = (a) => rel(a, true);
const line = (a) => rel(a, false);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bz = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};
const bzPts = (p0, p1, p2, p3, k) => Array.from({ length: k + 1 }, (_, i) => bz(p0, p1, p2, p3, i / k));
const qPts = (p0, p1, p2, k) => Array.from({ length: k + 1 }, (_, i) => {
  const t = i / k, u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
});
// Catmull-Rom through points, sampled as a polyline.
function smooth(pts, k = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let j = i ? 1 : 0; j <= k; j++) out.push(bz(p1, c1, c2, p2, j / k));
  }
  return out;
}
// A soft, non-periodic edge along y from x0 to x1: seeded knots, smoothed.
function wobble(x0, x1, y, amp, step, r) {
  const knots = [];
  for (let x = x0; x < x1; x += step * (0.7 + 0.6 * r())) knots.push([x, y + (r() - 0.5) * 2 * amp]);
  knots.push([x1, y + (r() - 0.5) * 2 * amp]);
  return smooth(knots, 3);
}
// Small round dots as one path of round-capped strokes.
const dotPath = (list) => list.map(([x, y]) => `M${n(x)} ${n(y)}h.1`).join('');
const dots = (s, fill, list, w) => (fill && list.length ? s('path', { fill: 'none', stroke: fill, 'stroke-width': w, 'stroke-linecap': 'round', d: dotPath(list) }) : null);
// A band whose top edge is a row of shallow round scallops of seeded widths (sky steps only).
function scallopBand(x0, x1, y, yb, w, h, r) {
  let d = `M${n(x0)} ${n(yb)}V${n(y)}`;
  let x = x0;
  while (x < x1) {
    const ww = Math.round(w * (0.6 + 0.8 * r()) * 10) / 10;
    const hh = h * (0.5 + r());
    const rad = n((ww * ww / 4 + hh * hh) / (2 * hh));
    x += ww;
    d += `a${rad} ${rad} 0 0 1 ${n(ww)} 0`;
  }
  return d + `V${n(yb)}z`;
}
// A flat-bottomed lens: a thin cloud or a band of haze.
const lens = (x0, x1, y, h, skew = 0.3) => poly([[x0, y], ...bzPts([x0, y], [lerp(x0, x1, skew), y - h * 1.33], [lerp(x0, x1, 0.8), y - h * 1.33], [x1, y], 10).slice(1)]);
const P = (s, fill, d) => (fill && d ? s('path', { fill, d }) : null);
const L = (s, stroke, w, d) => (stroke && d ? s('path', { fill: 'none', stroke, 'stroke-width': n(w), 'stroke-linecap': 'round', d }) : null);
const fromLeft = (light) => light === 'L' || light === 'LL';
const fromRight = (light) => light === 'R' || light === 'RR';

// ---------- tiny life, in silhouette ----------
// Umbrella acacia (Acacia tortilis): a thin flat crown on a forked trunk.
// Local units, origin at the foot of the trunk, 20 wide, 11 tall.
const ACACIA_CROWN = [[-10, -8.6], [-8.6, -9.9], [-4, -10.9], [3, -10.9], [8, -10.1], [10.3, -8.5], [7, -7.8], [3.6, -8.2], [0, -7.6], [-3.6, -8.1], [-7.4, -7.6]];
const ACACIA_TRUNK = [[-0.8, 0], [0.8, 0], [0.6, -3.6], [5.2, -8], [3.8, -8], [0.2, -5], [-3.6, -8], [-5, -8], [-0.7, -3.6]];
const ACACIA_TINY = [[-10, -8.4], [-6, -10.6], [6, -10.6], [10, -8.4], [1.2, -8], [1.2, 0], [-1.2, 0], [-1.2, -8]];
const ACACIA_LIT = [[-9.4, -9.6], [-6.4, -10.5], [-2, -11], [1, -10.9], [0.4, -10.2], [-3, -10.1], [-6.8, -9.8]];
const at = (list, x, y, k, flip = 1) => list.map(([a, b]) => [x + a * k * flip, y + b * k]);

function acacia(s, x, y, w, c, light) {
  const k = w / 20;
  const out = [];
  if (c.shadow && light !== 'N') {
    // A thin lens of shade on the ground, thrown away from the sun; at noon, a pool underneath.
    const dir = fromLeft(light) ? 1 : fromRight(light) ? -1 : 0;
    const len = light === 'LL' || light === 'RR' ? 2.1 : light === 'T' ? 0.55 : 1.1;
    const hw = w * 0.5 * len, cx = x + dir * hw * 0.8, hh = Math.max(0.35, w * 0.055);
    out.push(P(s, c.shadow, `M${n(cx - hw)} ${n(y)}Q${n(cx)} ${n(y - hh)} ${n(cx + hw)} ${n(y)}Q${n(cx)} ${n(y + hh)} ${n(cx - hw)} ${n(y)}Z`));
  }
  const sw = n(Math.max(0.25, 0.45 * k));
  const d = w < 4.5 ? poly(at(ACACIA_TINY, x, y, k)) : poly(at(ACACIA_CROWN, x, y, k)) + poly(at(ACACIA_TRUNK, x, y, k));
  out.push(s('path', { fill: c.tree, stroke: c.tree, 'stroke-width': sw, 'stroke-linejoin': 'round', d }));
  if (c.lit && w >= 6) {
    const flip = fromRight(light) ? -1 : 1;
    out.push(P(s, c.lit, light === 'T' ? poly(at(ACACIA_LIT, x, y, k)) + poly(at(ACACIA_LIT, x, y, k, -1)) : poly(at(ACACIA_LIT, x, y, k, flip))));
  }
  return out;
}

// A dromedary in profile, walking left, on a 9.5 x 8 grid: hump, neck and four legs.
function camel(x, y, k, step, dir = 1) {
  const C = [[0, 1.7], [0.5, 1], [1.7, 0.9], [2.4, 1.5], [3.1, 3], [4.2, 2.5], [5.4, 0.9], [6.5, 0.8], [7.8, 2.1], [9, 2.7], [9.5, 3.5], [9.2, 4.5],
    [9 + step, 8], [8.5 + step, 8], [8.3, 5.3], [7.8, 5.4], [7.6 - step, 8], [7.1 - step, 8], [7.2, 5.1], [5.1, 5.1], [4.8 + step * 0.6, 8], [4.3 + step * 0.6, 8], [4.1, 5],
    [3.8, 4.9], [3.5 - step, 8], [3 - step, 8], [3.1, 4.4], [2.4, 3.3], [1.5, 2.3], [0.5, 2.3]];
  return poly(C.map(([px, py]) => [x + dir * (px - 4.75) * k, y - 8 * k + py * k]));
}

// =====================================================================
// Tuwaiq: the Edge of the World
// =====================================================================
const H = 232; // strip height; the bottom ~70 sits under the tab bar
const HZ = 100; // horizon
const VPX = 372; // where the chain of prows meets the horizon
const VP2 = 1400; // where the flank faces' level lines meet the horizon
const PROW_X = [362, 347, 322, 284, 226, 148]; // nose of each prow, far to near

// Colour sets. prow rows, far (0) to near (5): [A the flank wall toward us,
// B the nose face turned west, SA the apron under A, SB the apron under the
// nose, toe the gentle foot of the apron]. For the near prow and the hero
// ([near, hero]): bed and bedB, the recessed soft beds on the wall and the
// nose; cone, the talus cones' [sun side, shade side]; ledge, the dark line
// where wall meets apron. gully: [face turned to the sun, face away, core];
// cap: the lit lip per prow.
const STRIP = {
  dawn: {
    light: 'LL',
    lens: [[292, 360, 24, 1.5, K.p2], [196, 246, 40, 1.1, K.p1]], glow: K.p1,
    prow: [
      [K.s3, K.s3, K.s3, K.s3], [K.s3, K.s3, K.s3, K.s3], [K.s4, K.s4, K.s3, K.s4],
      [K.s4, K.r4, K.s3, K.s4], [K.r4, K.r5, K.s4, K.r5, K.s3], [K.r5, K.r7, K.r4, K.s6, K.s4],
    ],
    bed: [K.r5, K.s6], bedB: [K.s6, K.ru], cone: [[K.s3, K.r4], [K.s4, K.r5]], ledge: [K.r5, K.s6],
    gully: [K.r4, K.r7, K.ru], cap: [null, null, K.r4, K.r4, K.r4, K.r4], under: K.s6,
    plain: [K.p1, K.pg, K.s3], haze: K.p1, wadi: K.pg, scrub: K.s4, stip: K.s4,
    shadow: [K.s3, K.s3, K.s4], shadowLen: 130,
    tree: K.ru, treeFar: K.r5, treeLit: K.r4, treeShadow: K.s4, camel: K.r7,
  },
  morning: {
    light: 'L',
    prow: [
      [K.s3, K.s3, K.p1, K.p1], [K.s3, K.s3, K.p1, K.p1], [K.s3, K.s4, K.pg, K.s3],
      [K.s4, K.r4, K.s3, K.s4], [K.s4, K.r5, K.s3, K.r4, K.pg], [K.r4, K.s6, K.s4, K.r5, K.s3],
    ],
    bed: [K.r4, K.r5], bedB: [K.s6, K.r7], cone: [[K.pg, K.s4], [K.s3, K.r4]], ledge: [K.r4, K.r5],
    gully: [K.s4, K.s6, K.r7], cap: [null, null, K.p2, K.p2, K.p2, K.p2], under: K.r5,
    plain: [K.p2, K.p1, K.pg], haze: K.p2, wadi: K.p1, scrub: K.s4, stip: K.s4,
    shadow: [K.pg, K.s3, K.s4], shadowLen: 84,
    tree: K.r7, treeFar: K.r5, treeLit: K.r4, treeShadow: K.s3, camel: K.r7,
  },
  midday: {
    light: 'T',
    prow: [
      [K.s3, K.s3, K.p1, K.p1], [K.s3, K.s3, K.p1, K.p1], [K.s3, K.s3, K.pg, K.pg],
      [K.s3, K.s4, K.pg, K.s3], [K.s3, K.s4, K.pg, K.s3, K.p1], [K.s4, K.r4, K.s3, K.s4, K.pg],
    ],
    bed: [K.s4, K.r4], bedB: [K.r4, K.r5], cone: [[null, K.s3], [null, K.s4]], ledge: [K.s4, K.r4],
    gully: [K.r4, K.r5, K.s6], cap: [null, null, K.p2, K.p2, K.p2, K.p2], under: K.r4,
    plain: [K.p2, K.p1, K.s3], haze: K.p2, wadi: K.pg, scrub: K.s4, stip: K.s4,
    shadow: null,
    tree: K.r7, treeFar: K.r5, treeLit: K.r4, treeShadow: K.s3, camel: K.r7,
  },
  afternoon: {
    light: 'R',
    prow: [
      [K.s3, K.pg, K.p1, K.p1], [K.s3, K.pg, K.p1, K.p1], [K.s4, K.s3, K.pg, K.pg],
      [K.s4, K.s3, K.s3, K.pg], [K.r4, K.s3, K.s3, K.pg, K.pg], [K.r5, K.s3, K.s4, K.pg, K.s3],
    ],
    bed: [K.r5, K.s6], bedB: [K.s4, K.s4], cone: [[K.pg, K.s4], [K.s3, K.r4]], ledge: [K.r5, K.s6],
    gully: [K.r4, K.s6, K.r7], cap: [null, null, K.p2, K.p2, K.p2, K.p2], under: K.s6,
    plain: [K.p1, K.pg, K.s3], haze: K.p1, wadi: K.pg, scrub: K.s4, stip: K.s4,
    shadow: null, treeLong: true,
    tree: K.r7, treeFar: K.r5, treeLit: K.s3, treeShadow: K.s4, camel: K.r7,
  },
  dusk: {
    light: 'RR',
    sky: [[42, K.s3], [62, K.s4], [82, K.r4]], skyW: 46, skyH: 1.6,
    lens: [[214, 276, 26, 1.3, K.p2]],
    prow: [
      [K.r5, K.s3, K.r5, K.s3], [K.r5, K.s3, K.r5, K.s3], [K.r5, K.s3, K.r5, K.s4],
      [K.s6, K.s4, K.r5, K.r4], [K.s6, K.s4, K.r5, K.r4, K.r4], [K.r7, K.r4, K.s6, K.r4, K.r5],
    ],
    bed: [K.r7, K.ru], bedB: [K.r4, K.r5], cone: [[K.r4, K.s6], [K.r5, K.r7]], ledge: [K.r7, K.ru],
    gully: [K.s6, K.ru, K.ink], cap: [null, null, K.s3, K.s4, K.r4, K.r4], under: K.ru,
    plain: [K.s3, K.s4, K.s4], haze: K.s3, wadi: K.s3, scrub: K.r5, stip: K.r5, stipN: 70,
    shadow: null,
    tree: K.ru, treeFar: K.s6, treeLit: K.r4, treeShadow: K.r5, camel: K.ru,
  },
  night: {
    // Moonlight from the west: pale rims on the caps, the nose faces a little lit.
    light: 'N',
    sky: [[16, K.s3], [27, K.s4], [40, K.mg], [55, K.q]], skyW: 60, skyH: 1.1, stars: true,
    prow: [
      [K.r7, K.r7, K.r7, K.r7], [K.r7, K.r7, K.r7, K.r7], [K.r7, K.q, K.r7, K.r7],
      [K.bd, K.q, K.r7, K.q], [K.bd, K.q, K.r7, K.q, K.q], [K.ru, K.q, K.r7, K.r7, K.q],
    ],
    bed: [K.ru, K.ink], bedB: [K.r7, K.r7], cone: [[K.q, K.bd], [K.q, K.bd]], ledge: null,
    gully: null, cap: null, rim: [K.mg, K.mg, K.mg, K.mg, K.s4, K.s3], under: null,
    plain: [K.mg, K.mg, K.q], haze: K.mg, wadi: K.mg, scrub: null, stip: K.r7, stipN: 80,
    shadow: null,
    tree: K.ink, treeFar: K.bd, treeLit: null, treeShadow: null, camel: K.ink,
  },
};

function prowGeo(xn, idx) {
  const s = (VPX - xn) / (VPX - 148);
  const yt = HZ - 66 * s;
  const yf = HZ + 48 * s;
  const wallF = [0.34, 0.36, 0.33, 0.37, 0.35, 0.35][idx];
  const yw = yt + (yf - yt) * wallF;
  const lean = 6 * s;
  const reach = [0.85, 0.9, 1, 0.92, 0.95, 1][idx] * 96 * s;
  const xf = xn + lean + reach;
  const c = s < 0.3 ? 0 : [0, 0, 0, 12, 17, 14][idx] * s;
  const xc = xn - c;
  const ytc = yt - c * (HZ - yt) / (VPX - xc);
  const ywc = yw - c * (HZ - yw) / (VPX - xc);
  const topA = (x) => HZ - (HZ - ytc) * (VP2 - x) / (VP2 - xc);
  const stepA = (x) => HZ - (HZ - ywc) * (VP2 - x) / (VP2 - xc - lean);
  // The nose: a cap lip, an undercut notch, one ledge part way down.
  const hw = yw - yt;
  const nose = [[xn, yt], [xn + 0.5 * s, yt + 0.05 * hw], [xn - 0.4 * s, yt + 0.1 * hw], [xn + lean * 0.45 + 0.6 * s, yt + 0.52 * hw],
    [xn + lean * 0.5 - 0.6 * s, yt + 0.58 * hw], [xn + lean, yw]];
  const a0 = [xn + lean, yw];
  const apron = bzPts(a0, [a0[0] + 7 * s, yw + (yf - yw) * 0.5], [a0[0] + reach * 0.42, yf - 0.4 * s], [xf, yf], s < 0.3 ? 5 : 10);
  const capH = Math.max(0.6, 2.4 * s);
  const uH = Math.max(0.4, 1.3 * s);
  const xsplit = lerp(xc + lean, xf, 0.32);
  return { s, xn, yt, yf, yw, lean, xf, c, xc, ytc, ywc, topA, stepA, nose, apron, capH, uH, xsplit };
}

// Apron top at x for a prow (the step line on the flank, the curve past the nose).
function apronTopAt(g, x) {
  if (x <= g.xn + g.lean) return g.stepA(x);
  for (let i = 1; i < g.apron.length; i++) {
    const [x0, y0] = g.apron[i - 1], [x1, y1] = g.apron[i];
    if (x <= x1) return lerp(y0, y1, (x - x0) / Math.max(0.01, x1 - x0));
  }
  return g.yf;
}

// Hero detail, fixed by hand. Gullies [x at the cap, width, depth down the wall, lean];
// soft beds [top, bottom] as fractions of the wall; strata hairlines; talus cones
// [x at the wall foot, half width at the plain, skew, bulge onto the plain].
const GULLIES = [[17, 7, 1, 1.4], [71, 4, 0.66, -0.4], [113, 5.6, 0.92, 0.6]];
const HERO_BEDS = [[0.27, 0.315], [0.61, 0.655]];
const HERO_STRATA = [0.13, 0.45, 0.53, 0.81];
// Ravines down the apron [x at the wall foot, length, drift, width, half width of the
// debris fan at its foot (0: none)].
const HERO_RAVINES = [[18.4, 1, 3, 6.4, 11], [37, 0.42, 1.2, 2.4, 0], [70.6, 0.9, -2.6, 5, 8], [89, 0.34, 0.6, 2, 0], [113.6, 1, 3.6, 6, 10], [130, 0.5, 2, 2.6, 0]];
const P2_BEDS = [[0.46, 0.52]];
const P2_STRATA = [0.24, 0.74];
const P2_RAVINES = [[172, 1, 1.4, 4.4, 8], [194, 0.5, 0.6, 2.4, 0], [212, 1, 1.6, 4, 7]];

function drawProw(s, g, idx, c) {
  const [A, B, SA, SB, TOE] = c.prow[idx];
  const hero = idx === 5, p2 = idx === 4, near = hero || p2;
  const ni = hero ? 1 : 0;
  const BED = c.bed && c.bed[ni], BEDB = c.bedB && c.bedB[ni], CONE = c.cone && c.cone[ni], LEDGE = c.ledge && c.ledge[ni];
  const rr = rng(500 + idx), rb = rng(600 + idx), rs = rng(700 + idx);
  const out = [];
  const left = -2;
  const x0 = hero ? left : PROW_X[5] + 2; // the near wall's part that shows
  const sil = [[left, g.topA(left)], [g.xc, g.ytc], ...g.nose, ...g.apron.slice(1), [g.xf, g.yf], [left, g.yf]];
  out.push(P(s, A, poly(sil)));
  const wallTop = (x) => g.topA(x) + g.capH + g.uH;
  const yAt = (x, f) => lerp(wallTop(x), g.stepA(x), f);
  const noseY = (f, atNose) => (atNose ? lerp(g.yt + g.capH + g.uH, g.yw, f) : lerp(g.ytc + g.capH + g.uH, g.ywc, f));
  const noseFace = poly([[g.xc, g.ytc], ...g.nose, [g.xc + g.lean, g.ywc]]);

  // Soft beds that weather back: long, slightly uneven bands across the wall and the nose.
  if (near && BED) {
    let d = '', dB = '';
    for (const [fa, fb] of hero ? HERO_BEDS : P2_BEDS) {
      const xs = [];
      for (let x = x0; x < g.xc; x += 12 + rb() * 10) xs.push(x);
      xs.push(g.xc);
      const top = xs.map((x) => [x, yAt(x, fa + (rb() - 0.5) * 0.02)]);
      const bot = xs.map((x) => [x, yAt(x, fb + (rb() - 0.5) * 0.025)]).reverse();
      d += poly([...top, ...bot]);
      if (g.c > 0) dB += poly([[g.xc + g.lean * fa, noseY(fa)], [g.xn + g.lean * fa, noseY(fa, 1)], [g.xn + g.lean * fb, noseY(fb, 1)], [g.xc + g.lean * fb, noseY(fb)]]);
    }
    out.push(P(s, BED, d));
    if (g.c > 0) out.push(P(s, B, noseFace), P(s, BEDB, dB));
  } else if (g.c > 0) {
    out.push(P(s, B, noseFace));
  }

  // Gullies on the hero: a V cut down the wall, one inner face turned to the sun.
  if (hero && c.gully) {
    const [gLit, gSh, gCore] = c.gully;
    let dl = '', dr = '', dc = '';
    for (const [x, w, dep, ln] of GULLIES) {
      const y0 = wallTop(x) - g.uH - 0.4, bx = x + ln, y1 = yAt(bx, dep);
      const ym = lerp(y0, y1, 0.4);
      dl += poly([[x - w / 2, y0], [x - 0.25, y0 + 1], [bx - 0.2, y1], [x + ln * 0.4 - w * 0.22, ym]]);
      dr += poly([[x + 0.25, y0 + 1], [x + w / 2, y0], [x + ln * 0.4 + w * 0.2, ym], [bx + 0.2, y1]]);
      dc += poly([[x - 0.45, y0 + 0.8], [x + 0.45, y0 + 0.8], [bx + 0.25, y1], [bx - 0.25, y1]]);
    }
    // the left inner face looks right (west), the right inner face looks left (east)
    const lit = fromLeft(c.light) ? 'r' : fromRight(c.light) ? 'l' : 'both';
    out.push(P(s, lit === 'l' || lit === 'both' ? gLit : gSh, dl), P(s, lit === 'r' || lit === 'both' ? gLit : gSh, dr), P(s, gCore, dc));
  }

  // Strata: a few long hairlines across the walls, broken at the gullies and here and there.
  if (near && BED && c.light !== 'N') {
    const breaks = hero ? GULLIES.map(([x, w, dep, ln]) => [x - w / 2 - 0.4, x + w / 2 + Math.abs(ln) + 0.4, dep]) : [];
    let d = '';
    for (const f of hero ? HERO_STRATA : P2_STRATA) {
      const segs = [];
      let xa = x0 + rs() * 6;
      for (const [b0, b1, dep] of breaks) { if (dep < f) continue; if (b0 > xa) segs.push([xa, b0]); xa = Math.max(xa, b1); }
      segs.push([xa, g.xc - 0.5]);
      for (const [a, b] of segs) {
        if (b - a < 3) continue;
        const ff = f + (rs() - 0.5) * 0.015;
        // one gap in a long run, so the lines read as rock, not ruling
        if (b - a > 30 && rs() < 0.7) {
          const m = lerp(a, b, 0.25 + rs() * 0.5), gw = 2 + rs() * 5;
          d += line([[a, yAt(a, ff)], [m - gw, yAt(m - gw, ff)]]) + line([[m + gw, yAt(m + gw, ff + 0.01)], [b, yAt(b, ff + 0.01)]]);
        } else d += line([[a, yAt(a, ff)], [b, yAt(b, ff)]]);
      }
      if (g.c > 0) d += line([[g.xc + g.lean * f + 0.5, noseY(f)], [g.xn + g.lean * f - 0.4, noseY(f, 1)]]);
    }
    out.push(L(s, c.light === 'RR' ? H30 : H25, 0.4, d));
  }

  // The hard cap: an undercut, then the lit lip of limestone on top (or the moon's rim).
  const tl = g.topA(left);
  if (idx >= 3 && c.under) {
    out.push(P(s, c.under, poly([[left, tl + g.capH], [g.xc, g.ytc + g.capH], [g.xn + 0.4 * g.s, g.yt + g.capH], [g.xn - 0.2 * g.s, g.yt + g.capH + g.uH], [g.xc, g.ytc + g.capH + g.uH], [left, tl + g.capH + g.uH]])));
  }
  const capC = c.rim ? c.rim[idx] : c.cap && c.cap[idx];
  if (capC) {
    const h = c.rim ? Math.max(0.6, g.capH * 0.6) : g.capH;
    out.push(P(s, capC, poly([[left, tl], [g.xc, g.ytc], [g.xn, g.yt], [g.xn + 0.5 * g.s, g.yt + h], [g.xc, g.ytc + h], [left, tl + h]])));
  }

  // The apron of scree and soft beds under the flank wall.
  out.push(P(s, SA, poly([[left, g.stepA(left)], [g.xc + g.lean, g.ywc], [g.xn + g.lean, g.yw], ...g.apron.slice(1), [g.xf, g.yf], [left, g.yf]])));
  // The toe: the gentle foot of the apron catches more light than its steep upper slope.
  if (TOE) {
    const r = rng(800 + idx);
    const edge = [];
    for (const [x, y] of wobble(left, g.xf, 0, 0.7 * g.s, 18, r)) {
      const yy = lerp(apronTopAt(g, x), g.yf, 0.6) + y;
      if (yy >= g.yf - 0.3) break;
      edge.push([x, yy]);
    }
    const last = edge[edge.length - 1];
    out.push(P(s, TOE, poly([...edge, [last[0] + (g.xf - last[0]) * 0.6, g.yf], [left, g.yf]])));
  }
  const rav = near ? (hero ? HERO_RAVINES : P2_RAVINES) : [];
  if (near && CONE) {
    const [cLit, cSh] = CONE;
    // Scree: a fine stipple on the steep upper apron, thickest under the wall.
    const r = rng(900 + idx), scree = [];
    for (let i = 0; i < (hero ? 80 : 36); i++) {
      const x = lerp(x0 + 1, hero ? g.xn + 20 : g.xn + 10, r());
      const top = apronTopAt(g, x);
      const y = lerp(top + 1.2, lerp(top, g.yf, 0.6), Math.pow(r(), 1.6));
      if (r() < 0.85) scree.push([x, y]);
    }
    // Ravines cut down the apron from the gully mouths, curving out as the apron flares,
    // tapering as they fade; the flank turned to the sun lit, the flank turned away in shade.
    // Where the long ones reach the plain, a low fan of debris spills over the foot.
    let dLit = '', dSh = '', dFan = '';
    for (const [x, len, drift, wf, fan] of rav) {
      const y0 = g.stepA(x) + 0.3, ex = x + drift * 2.2, y1 = lerp(y0, g.yf, 0.22 + len * 0.54);
      const w = wf * g.s * 0.8;
      const ctr = qPts([x, y0], [x + drift * 0.3, lerp(y0, y1, 0.55)], [ex, y1], 6);
      const half = (side) => ctr.map(([cx, cy], i) => [cx + side * (w * 0.5 * Math.sin(Math.PI * Math.min(1, (i + 1) / 6.5) * 0.92) + 0.2), cy]);
      const lPoly = poly([[x, y0 - 0.6], ...half(-1), ...ctr.slice().reverse()]);
      const rPoly = poly([[x, y0 - 0.6], ...ctr, ...half(1).reverse()]);
      // a groove: its right flank faces left (east), its left flank faces right (west)
      if (c.light === 'T') dSh += lPoly + rPoly;
      else if (fromRight(c.light) || c.light === 'N') { dLit += lPoly; dSh += rPoly; }
      else { dLit += rPoly; dSh += lPoly; }
      if (fan) {
        const fx = ex + drift * 1.2, fw = fan * g.s;
        dFan += poly(qPts([fx - fw, g.yf - 0.3], [fx + fw * 0.1, g.yf + 4.6 * g.s], [fx + fw * 1.2, g.yf - 0.3], 6));
      }
    }
    out.push(dots(s, cSh || cLit, scree, 0.6), P(s, cLit, dLit), P(s, cSh, dSh), P(s, TOE || SA, dFan));
  }
  if (near && LEDGE) {
    // a dark ledge where the wall stands on the apron
    const lh = 1.1 * g.s;
    out.push(P(s, LEDGE, poly([[x0, g.stepA(x0)], [g.xc + g.lean, g.ywc], [g.xc + g.lean, g.ywc + lh * 0.7], [x0, g.stepA(x0) + lh]])));
  }
  if (g.c > 0) out.push(P(s, SB, poly([[g.xc + g.lean, g.ywc], [g.xn + g.lean, g.yw], ...g.apron.slice(1), [g.xf, g.yf], [g.xsplit, g.yf]])));
  return out;
}

function stars(s) {
  const pts = [[172, 70], [198, 54], [226, 76], [244, 58], [276, 69], [300, 52], [338, 64], [364, 55], [384, 74], [206, 90], [262, 91], [312, 84], [158, 58], [286, 88]];
  const big = [[244, 58], [300, 52], [364, 55], [172, 70]];
  // al-Thurayya, a tiny knot of six
  const knot = [[320, 45], [322.6, 43.8], [324, 46.2], [321.6, 47.6], [325.6, 44.4], [318.8, 47.8]];
  // Suhail, low in the south over the far prows, with a four-point glint
  const sx = 352, sy = 86, g = 0.6, a = 3.2;
  const glint = poly([[sx, sy - a], [sx + g, sy - g], [sx + a, sy], [sx + g, sy + g], [sx, sy + a], [sx - g, sy + g], [sx - a, sy], [sx - g, sy - g]]);
  const small = pts.filter((p) => !big.includes(p));
  return [dots(s, K.p1, [...small, ...knot], 1.1), dots(s, K.p1, big, 1.6), P(s, K.p1, glint)];
}

// A dry wadi: a pale braided bed that widens toward us, ragged at the banks,
// splitting round a bar of plain here and there, with scrub along the banks.
function wadi(centre, w0, w1, seed, braids) {
  const r = rng(seed);
  const pts = smooth(centre, 4);
  const k = pts.length - 1;
  const ribbonAt = (i0, i1, off, wk) => {
    const top = [], bot = [];
    for (let i = i0; i <= i1; i++) {
      const [x, y] = pts[i];
      const t = i / k;
      const taper = off ? Math.sin(Math.PI * (i - i0) / Math.max(1, i1 - i0)) : 1;
      const hw = lerp(w0, w1, t) / 2 * wk * (off ? Math.max(0.25, taper) : 1);
      const o = off * taper * lerp(w0, w1, t);
      top.push([x, y + o - hw * (0.55 + 0.9 * r())]);
      bot.push([x, y + o + hw * (0.55 + 0.9 * r())]);
    }
    return poly([...top, ...bot.reverse()]);
  };
  let bed = ribbonAt(0, k, 0, 1);
  for (const [t0, t1, off, wk] of braids) bed += ribbonAt(Math.round(t0 * k), Math.round(t1 * k), off, wk);
  const scrub = [];
  pts.forEach(([x, y], i) => {
    const hw = lerp(w0, w1, i / k) / 2;
    if (r() < 0.45) scrub.push([x + (r() - 0.5) * 3, y - hw - 0.9 - r() * 1.2]);
    if (r() < 0.25) scrub.push([x + (r() - 0.5) * 3, y + hw + 0.9 + r() * 1.2]);
  });
  return { bed, scrub };
}

export function tuwaiqScene(s, phase, { label = '' } = {}) {
  const c = STRIP[phase] || STRIP.midday;
  const tl = c.treeLong ? 'RR' : c.light; // the acacias' shadows run long in the golden hour
  const kids = [];
  const W = 390;
  const prows = PROW_X.map((x, i) => prowGeo(x, i));

  // Sky: the page itself by day; stepped bands with shallow scallops at dusk and night,
  // a thin pale glow low on the horizon at dawn, and a cloud lens or two at dawn and dusk.
  const sr = rng(5);
  for (const [y, col] of c.sky || []) kids.push(P(s, col, scallopBand(-8, W + 8, y, HZ + 1, c.skyW, c.skyH, sr)));
  if (c.stars) kids.push(...stars(s));
  for (const [x0, x1, y, h, col] of c.lens || []) kids.push(P(s, col, lens(x0, x1, y, h)));
  if (c.glow) kids.push(P(s, c.glow, poly([[236, HZ + 1], ...bzPts([236, HZ + 1], [290, 95.6], [340, 95.4], [W + 2, 96.2], 8).slice(1), [W + 2, HZ + 1]])));

  // The plain in three flat bands, palest at the horizon, with soft uneven edges.
  const br = rng(9);
  kids.push(P(s, c.plain[0], `M-2 ${HZ}H${W + 2}V${H}H-2Z`));
  for (const [i, y] of [[1, 106], [2, 120]]) kids.push(P(s, c.plain[i], poly([...wobble(-2, W + 2, y, 0.5, 40, br), [W + 2, H], [-2, H]])));
  const bandAt = (y) => (y >= 120 ? 2 : y >= 106 ? 1 : 0);
  // A low outlier butte on the western horizon.
  kids.push(P(s, c.prow[0][0], 'M379.6 100.2L381.2 98.2L387.8 98L389.6 100.2Z'));

  // In the morning the escarpment throws its shadow west across the plain.
  const shadowFor = (g) => {
    if (!c.shadow) return null;
    const len = c.shadowLen * g.s;
    return P(s, c.shadow[bandAt(g.yf - 0.5)], poly([[g.xf - 22 * g.s, g.yf], [g.xf + len, g.yf], [g.xf + len * 0.8, g.yf - 2.4 * g.s], [g.xf - 4 * g.s, g.yf - 6 * g.s]]));
  };

  // The far chain, the haze that floats its feet, then nearer prows over the plain.
  for (let i = 0; i < 3; i++) kids.push(...drawProw(s, prows[i], i, c), shadowFor(prows[i]));
  kids.push(P(s, c.haze, poly([[258, 102.8], ...bzPts([258, 102.8], [290, 101.4], [330, 101.2], [W + 2, 101.3], 6).slice(1), [W + 2, 103.9], ...bzPts([W + 2, 103.9], [340, 104.1], [300, 103.8], [258, 102.8], 6).slice(1)])));
  for (const [x, y, w] of [[318, 113.2, 3], [341, 112.4, 2.8], [364, 112.8, 3.2]]) kids.push(...acacia(s, x, y, w, { tree: c.treeFar }, tl));
  kids.push(...drawProw(s, prows[3], 3, c), shadowFor(prows[3]));
  const wb = wadi([[292, 132.2], [306, 130.4], [324, 129.8], [344, 127.6], [366, 127], [394, 125.2]], 0.8, 1.7, 21, [[0.3, 0.55, -0.9, 0.6]]);
  kids.push(P(s, c.wadi, wb.bed));
  for (const [x, y, w] of [[302, 128.6, 4.2], [320, 127.6, 4.6], [358, 125.4, 4.4]]) kids.push(...acacia(s, x, y, w, { tree: c.treeFar, shadow: c.treeShadow }, tl));
  kids.push(...drawProw(s, prows[4], 4, c), shadowFor(prows[4]));
  // The near wadi, braided, out of the bay under the hero.
  const wa = wadi([[246, 150.4], [266, 147.8], [288, 146.6], [308, 143.2], [330, 141.6], [352, 138.8], [372, 137.8], [394, 135.8]], 1.2, 3.2, 33, [[0.06, 0.3, 1.1, 0.55], [0.42, 0.66, -1, 0.5]]);
  kids.push(P(s, c.wadi, wa.bed), dots(s, c.scrub, [...wa.scrub, ...wb.scrub], 0.8));
  // The caravan, four camels and a calf's length behind, between the wadis.
  kids.push(P(s, c.camel, [camel(322, 136, 0.6, 0, 1), camel(331.4, 136.3, 0.6, 0.5, 1), camel(340.8, 136.6, 0.6, -0.3, 1), camel(349.2, 136.8, 0.45, 0.4, 1)].join('')));
  // The hero prow, then the acacias along the near wadi and one by the hero's toe.
  kids.push(...drawProw(s, prows[5], 5, c), shadowFor(prows[5]));
  for (const [x, y, w] of [[264, 145.4, 7], [294, 144.2, 6.2], [374, 135.6, 6.6], [240, 152.4, 7]]) {
    kids.push(...acacia(s, x, y, w, { tree: c.tree, lit: c.treeLit, shadow: c.treeShadow }, tl));
  }
  // Stipple on the near plain: a halftone that thickens toward us.
  const r = rng(1838);
  const fine = [], bold = [];
  for (let i = 0; i < (c.stipN || 130); i++) {
    const y = 124 + Math.pow(r(), 0.8) * (H - 124);
    const x = r() * W;
    const g = prows[5];
    const t = (y - 120) / (H - 120);
    if (r() > 0.2 + t || (x < g.xf + 4 && y < g.yf + 5)) continue;
    (r() < t * 0.6 ? bold : fine).push([x, y]);
  }
  kids.push(dots(s, c.stip, fine, 0.7), dots(s, c.stip, bold, 1.1));
  for (const [x, y, w] of [[150, 174, 8], [322, 168, 8]]) kids.push(...acacia(s, x, y, w, { tree: c.tree, lit: c.treeLit, shadow: c.treeShadow }, tl));

  return s('svg', {
    class: 'dunes', viewBox: `0 0 390 ${H}`, preserveAspectRatio: 'xMidYMax slice',
    role: label ? 'img' : 'presentation', 'aria-hidden': label ? null : 'true', 'aria-label': label || null, focusable: 'false',
  }, kids);
}

// =====================================================================
// Hisma: the ground under the dial's sun (340 x 214, horizon y 176)
// =====================================================================
// Tones per phase. Lit and shade switch sides with the sun. No rock face is as
// pale as the panel (#F1E3C7) the dial sits on.
const DIAL = {
  dawn: { light: 'LL', far: K.s3, fr: [K.s4, K.r4], capLit: K.s4, capSh: K.r5, wallLit: K.r4, wallSh: K.r5, cleft: K.s6, flute: H30, rim: null,
    mid: K.s4, midSh: K.r4, nearLit: K.r4, nearSh: K.r5, mTop: K.s4, mLit: K.r4, mSh: K.r5, mUnder: K.r7, stemLit: K.r5, stemSh: K.s6, mound: K.s4,
    stip: K.r5, tree: K.ru, treeSh: K.r4, camel: K.r7, ripple: H25, shadow: K.r5 },
  morning: { light: 'L', far: K.pg, fr: [K.s3, K.s4], capLit: K.s3, capSh: K.s4, wallLit: K.s4, wallSh: K.r5, cleft: K.s6, flute: H30, rim: null,
    mid: K.s3, midSh: K.s4, nearLit: K.r4, nearSh: K.r5, mTop: K.s3, mLit: K.s4, mSh: K.r5, mUnder: K.s6, stemLit: K.r4, stemSh: K.s6, mound: K.s3,
    stip: K.r5, tree: K.r7, treeSh: K.s4, camel: K.r7, ripple: H20, shadow: K.r5 },
  midday: { light: 'T', far: K.pg, fr: [K.s3, K.s4], capLit: K.s3, capSh: K.s4, wallLit: K.s4, wallSh: K.r4, cleft: K.r5, flute: H25, rim: null,
    mid: K.s3, midSh: K.s4, nearLit: K.r4, nearSh: K.r5, mTop: K.s3, mLit: K.s4, mSh: K.r4, mUnder: K.s6, stemLit: K.r4, stemSh: K.r5, mound: K.s3,
    stip: K.r5, tree: K.r7, treeSh: K.s4, camel: K.r7, ripple: H20, shadow: K.r4 },
  afternoon: { light: 'R', far: K.pg, fr: [K.s3, K.s4], capLit: K.s3, capSh: K.r5, wallLit: K.r4, wallSh: K.s6, cleft: K.r7, flute: H30, rim: null,
    mid: K.s3, midSh: K.s4, nearLit: K.r4, nearSh: K.r5, mTop: K.s3, mLit: K.r4, mSh: K.s6, mUnder: K.r7, stemLit: K.r5, stemSh: K.r7, mound: K.s3,
    stip: K.r5, tree: K.r7, treeSh: K.s4, camel: K.r7, ripple: H25, shadow: K.r5 },
  dusk: { light: 'RR', far: K.s4, fr: [K.r4, K.r5], capLit: K.r4, capSh: K.s6, wallLit: K.r5, wallSh: K.s6, cleft: K.r7, flute: H30, rim: null,
    mid: K.r4, midSh: K.r5, nearLit: K.r5, nearSh: K.s6, mTop: K.r4, mLit: K.r5, mSh: K.r7, mUnder: K.ru, stemLit: K.s6, stemSh: K.ru, mound: K.r4,
    stip: K.s6, tree: K.ru, treeSh: K.r5, camel: K.ru, ripple: H30, shadow: K.s6 },
  night: { light: 'N', far: K.mg, fr: [K.q, K.r7], farRim: K.mg, capLit: K.q, capSh: K.bd, wallLit: K.bd, wallSh: K.ru, cleft: K.ink, flute: null, rim: K.s3,
    mid: K.mg, midSh: K.q, nearLit: K.mg, nearSh: K.q, mTop: K.q, mLit: K.bd, mSh: K.ru, mUnder: K.ink, stemLit: K.bd, stemSh: K.ru, mound: K.q,
    stip: K.q, tree: K.ink, treeSh: null, camel: K.ink, ripple: null, shadow: null },
};

// A jebel: feet x, base y, where the wall tops out, then domes [x, y, height] along the skyline.
const RIGHTJ = { foot: [245.6, 292], base: 179.4, start: [249.6, 173], domes: [[255.6, 170.2, 1.4], [263, 166.6, 2.2], [271, 160.8, 3.4], [281.6, 153.6, 5.6], [289, 160.4, 3.2]] };
const LEFTJ = { foot: [47.4, 86.4], base: 179, start: [49.6, 170.2], domes: [[56.4, 167.2, 2.8], [66, 163.4, 4.4], [75.6, 165, 3.6], [82.2, 168.8, 2.2]] };

// The skyline of a jebel: the closed outline, the open top curve, and each dome's peak.
function skyline(j) {
  let top = `M${pt(j.start)}`;
  const peaks = [];
  let p = j.start;
  for (const [x, y, h] of j.domes) {
    const w = x - p[0];
    const hi = Math.min(p[1], y) - h * 1.1;
    const c1 = [p[0] + w * 0.04, hi], c2 = [x - w * 0.04, hi];
    top += `C${pt(c1)} ${pt(c2)} ${n(x)} ${n(y)}`;
    peaks.push({ x: p[0] + w * 0.5, y: bz(p, c1, c2, [x, y], 0.5)[1], a: p, b: [x, y], curve: [p, c1, c2, [x, y]], h });
    p = [x, y];
  }
  const outline = `M${n(j.foot[0])} ${n(j.base)}L` + top.slice(1) + `L${n(j.foot[1])} ${n(j.base)}Z`;
  return { outline, top, peaks };
}

function jebel(s, j, c, r) {
  const out = [];
  const { outline, top, peaks } = skyline(j);
  const litLeft = fromLeft(c.light);
  const noon = c.light === 'T';
  // The mass in shade, then a sun-side facet under each dome.
  out.push(P(s, c.wallSh, outline));
  let fl = '', fr = '';
  peaks.forEach((k, i) => {
    const xa = i === 0 ? j.foot[0] : k.a[0], xb = i === peaks.length - 1 ? j.foot[1] : k.b[0];
    const m = k.x + (r() - 0.5) * 1.2;
    const mid = lerp(k.y, j.base, 0.5);
    fl += poly([[xa, j.base], k.a, [m, k.y + 0.3], [m - 0.7, mid], [m + 0.3, j.base]]);
    fr += poly([[m, k.y + 0.3], k.b, [xb, j.base], [m + 0.3, j.base], [m - 0.7, mid]]);
  });
  out.push(P(s, c.wallLit, noon || litLeft ? fl : fr));
  // Faint bedding low in the walls, and dark melt streaks hanging under the domes.
  const sk = [j.start, ...j.domes.map(([x, y]) => [x, y])];
  const wallX = (y, sideLeft) => sideLeft
    ? lerp(j.foot[0], j.start[0], (j.base - y) / (j.base - j.start[1]))
    : lerp(j.foot[1], sk[sk.length - 1][0], (j.base - y) / (j.base - sk[sk.length - 1][1]));
  if (c.flute) {
    // a few short, broken beds low on the walls
    let d = '';
    for (const dy of [3.6, 6.6]) {
      const y = j.base - dy, xa = wallX(y, true) + 1, xb = wallX(y, false) - 1;
      for (let x = xa + r() * 4; x < xb - 3; x += 7 + r() * 6) d += line([[x, y + (r() - 0.5) * 0.4], [Math.min(xb, x + 3 + r() * 3), y + (r() - 0.5) * 0.4]]);
    }
    out.push(L(s, c.flute, 0.3, d));
  }
  let streak = '';
  peaks.forEach((k) => {
    if (k.h < 2) return;
    for (const f of [0.3, 0.72]) {
      const x = lerp(k.a[0], k.b[0], f) + (r() - 0.5);
      const y0 = lerp(k.y, Math.max(k.a[1], k.b[1]), 0.6) + 2.2;
      const len = 3 + r() * 5;
      if (y0 + len < j.base - 1) streak += poly([[x - 0.45, y0], [x + 0.45, y0], [x + 0.15, y0 + len], [x - 0.1, y0 + len]]);
    }
  });
  // Clefts between the domes.
  j.domes.slice(0, -1).forEach(([x, y]) => {
    const len = 4 + r() * 4;
    streak += poly([[x - 0.7, y + 0.4], [x + 0.7, y + 0.4], [x + 0.3, y + len], [x - 0.2, y + len + 0.6]]);
  });
  out.push(P(s, c.cleft, streak));
  // Pale summit sandstone: a cap on each dome, lit on the sun side.
  let capSun = '', capShade = '';
  peaks.forEach((k) => {
    const dep = Math.max(1.4, k.h * 0.55);
    const half = (t0, t1) => Array.from({ length: 6 }, (_, i) => bz(...k.curve, lerp(t0, t1, i / 5)));
    const L1 = half(0, 0.5), R1 = half(0.5, 1);
    const lp = poly([...L1, [k.x, k.y + dep], [k.a[0] + 0.5, k.a[1] + dep * 0.35]]);
    const rp = poly([...R1, [k.b[0] - 0.5, k.b[1] + dep * 0.35], [k.x, k.y + dep]]);
    if (noon) capSun += lp + rp;
    else if (litLeft) { capSun += lp; capShade += rp; }
    else { capSun += rp; capShade += lp; }
  });
  out.push(P(s, c.capSh, capShade), P(s, c.capLit, capSun));
  // Moonlight along the domes, just inside the skyline.
  if (c.rim) out.push(s('path', { fill: 'none', stroke: c.rim, 'stroke-width': 0.6, transform: 'translate(0 0.5)', d: top }));
  return out;
}

// A sand ramp banked against a rock: a concave crest from the toe up to where it
// reaches highest on the rock, then a sweep down along the rock's foot. It parts
// into the slope facing the toe and the steeper slope beyond the peak.
function ramp(toe, c1, c2, top, back, base) {
  const crest = bzPts(toe, c1, c2, top, 8);
  const fall = qPts(top, [lerp(top[0], back[0], 0.12), lerp(top[1], back[1], 0.85)], back, 6);
  const foot = [lerp(top[0], back[0], 0.22), base];
  return {
    all: poly([...crest, ...fall.slice(1), [back[0], base], [toe[0], base]]),
    toeSide: poly([...crest, foot, [toe[0], base]]),
    backSide: poly([...fall, [back[0], base], foot]),
  };
}

export function hismaGround(s, phase) {
  const c = DIAL[phase] || DIAL.midday;
  const r = rng(2021);
  const kids = [];
  const litLeft = fromLeft(c.light);
  const noon = c.light === 'T';

  // The far plain: flat, rounding down only at the two ends, clear of the arc's feet and the end ticks.
  kids.push(P(s, c.far, 'M0 214C4 198 15 185.4 31 180C40 177.6 48 176.8 60 176.6L280 176.6C292 176.8 301 177.8 309 180C325 185 336 198 340 214Z'));
  // Far domes in one low frieze: rounded shoulders, irregular clefts, soft shade on the side away from the sun.
  const frieze = smooth([[90, 177.4], [96, 174.6], [103, 171.8], [112, 170.8], [119, 171.4], [123, 173.2], [127, 170.8], [135, 168.4], [145, 167.8], [154, 168.9], [160, 171.6],
    [168, 171.8], [178, 171.2], [186, 171.9], [190, 173.4], [195, 170.6], [204, 168.6], [214, 168.2], [223, 169.6], [230, 171.8], [238, 174], [246, 177.4]], 3);
  kids.push(P(s, c.fr[0], poly(frieze)));
  const shoulders = litLeft || noon
    ? [[[145, 167.8], [154, 168.9], [160, 171.6], [161, 177], [151, 177]], [[214, 168.2], [223, 169.6], [230, 171.8], [238, 174], [240, 177], [221, 177]], [[112, 170.8], [119, 171.4], [123, 173.2], [124, 177], [116, 177]]]
    : [[[145, 167.8], [135, 168.4], [127, 170.8], [126, 177], [139, 177]], [[214, 168.2], [204, 168.6], [195, 170.6], [194, 177], [208, 177]], [[112, 170.8], [103, 171.8], [96, 174.6], [95, 177], [107, 177]]];
  kids.push(P(s, c.fr[1], shoulders.map((p) => poly(smooth(p.slice(0, -2), 2).concat(p.slice(-2)))).join('')));
  if (c.rim) kids.push(s('path', { fill: 'none', stroke: c.farRim, 'stroke-width': 0.5, transform: 'translate(0 0.4)', d: line(frieze.slice(2, -2)) }));
  // A thin shimmer of the plain floats the frieze on the horizon.
  kids.push(P(s, c.far, poly([[86, 177], ...bzPts([86, 177], [120, 175.6], [210, 175.5], [252, 177], 8).slice(1), [252, 178.4], [86, 178.4]])));

  // The jebels: a small group on the left, the hero massif on the right.
  kids.push(...jebel(s, LEFTJ, c, r));
  kids.push(...jebel(s, RIGHTJ, c, r));
  // Mid sand: a long low swell, flat across and dropping only at the ends, piled
  // up against each jebel in a ramp that leans up the rock.
  const rR = ramp([214, 183.4], [233, 183], [246.4, 179.8], [252.6, 170.6], [278, 182.7], 184.4);
  const rL = ramp([116, 184.4], [99, 184], [88, 180.4], [83.6, 171.4], [60, 184.4], 185.4);
  kids.push(P(s, c.mid, rR.all + rL.all));
  // the slope turned away from the sun, one step darker: the right ramp's toe faces east, the left ramp's west
  kids.push(P(s, c.midSh, (litLeft || noon ? rR.backSide : rR.toeSide) + (litLeft ? rL.toeSide : rL.backSide)));
  kids.push(P(s, c.mid, 'M2 214C5 200 12 191 30 187.6C62 183.8 102 184.6 132 185.2C170 186 198 183.2 232 182.6C266 182.2 292 183.4 308 186C323 189.6 332 200 338 214Z'));
  // Camels crossing the swell, well apart.
  kids.push(P(s, c.camel, [camel(170, 191, 0.78, 0, 1), camel(182.4, 191.2, 0.78, 0.5, 1), camel(194.6, 191.4, 0.74, -0.3, 1)].join('')));
  // Two acacias on the plain.
  const tc = { tree: c.tree, shadow: c.treeSh };
  kids.push(...acacia(s, 140, 184.6, 7.6, tc, c.light), ...acacia(s, 216, 184.2, 8, tc, c.light));

  // Near sand: a dune with a sharp crest, lit windward side, shaded slip face.
  kids.push(P(s, c.nearLit, 'M6 214C10 207 24 202.6 56 201.2C60 201 60 201 60 201C88 199.8 100 201.6 116 202.6C140 204 166 204.4 196 202.6C230 200.6 262 198.8 290 201.2C312 202.6 326 206 334 214Z'));
  kids.push(P(s, c.nearSh, litLeft || noon
    ? 'M196 202.6C230 200.6 262 198.8 290 201.2C312 202.6 326 206 334 214L308 214C298 209 278 206.4 260 205.8C238 205 214 205.4 196 202.6Z'
    : 'M6 214C10 207 24 202.6 56 201.2C60 201 60 201 60 201C88 199.8 100 201.6 116 202.6C102 204.6 86 205 70 206C52 207.2 30 210 22 214Z'));
  if (c.ripple) kids.push(L(s, c.ripple, 0.35, 'M128 207.4C150 206.6 172 207.6 192 207.4M226 208.6C246 207.8 262 208.6 280 209.6'));
  const dd = [];
  for (let i = 0; i < 46; i++) {
    const x = 30 + r() * 280, y = 204 + Math.pow(r(), 0.6) * 10;
    if (r() > (y - 201) / 13) continue;
    dd.push([x, y]);
  }
  kids.push(dots(s, c.stip, dd, 0.7));

  // The mushroom rock, after Umm Sarhej: a broad, tilted cap of pale sandstone,
  // cross-bedded, on a slender waisted stem that the sand has blasted thin.
  const mx = 112, my = 202, k = 0.94;
  const M = (list) => list.map(([x, y]) => [mx + x * k, my + y * k]);
  if (c.shadow && !noon) {
    const dir = litLeft ? 1 : -1, len = c.light === 'LL' || c.light === 'RR' ? 30 : 17;
    kids.push(P(s, c.shadow, `M${n(mx - dir * 3)} ${n(my + 0.4)}Q${n(mx + dir * len * 0.5)} ${n(my - 0.9)} ${n(mx + dir * len)} ${n(my + 0.2)}Q${n(mx + dir * len * 0.5)} ${n(my + 1.4)} ${n(mx - dir * 3)} ${n(my + 0.4)}Z`));
  }
  kids.push(P(s, c.mound, poly(M(qPts([-12, 0.8], [0, -4.4], [13, 0.8], 8)))));
  const stemL = [[-2.3, -11.6], [0.2, -11.6], [0.2, 0.2], [-3.4, 0.2], [-2.2, -2.4], [-1.3, -5.4], [-1.2, -8.2]];
  const stemR = [[0.2, -11.6], [2.5, -11.8], [1.5, -8.2], [1.6, -5.4], [2.4, -2.4], [3.6, 0.2], [0.2, 0.2]];
  // the whole stem in shade, then its sun side lit (at noon the cap shades all of it)
  const stem = [[-2.3, -11.6], [2.5, -11.8], [1.5, -8.2], [1.6, -5.4], [2.4, -2.4], [3.6, 0.2], [-3.4, 0.2], [-2.2, -2.4], [-1.3, -5.4], [-1.2, -8.2]];
  kids.push(P(s, c.stemSh, poly(M(stem))), P(s, noon ? null : c.stemLit, poly(M(litLeft ? stemL : stemR))));
  const cap = [[-10.8, -12.6], [-11.2, -16], [-9.8, -19.4], [-5.2, -21.4], [1.6, -22], [7.4, -21.2], [10.6, -19.4], [11.8, -16.6], [11.2, -13.6], [9.4, -12.4], [-9.2, -11.4]];
  const capLft = [[-10.8, -12.6], [-11.2, -16], [-9.8, -19.4], [-5.2, -21.4], [1.6, -22], [0.4, -17.2], [1, -11.9], [-9.2, -11.4]];
  const capRgt = [[1.6, -22], [7.4, -21.2], [10.6, -19.4], [11.8, -16.6], [11.2, -13.6], [9.4, -12.4], [1, -11.9], [0.4, -17.2]];
  kids.push(P(s, c.mSh, poly(M(cap))));
  kids.push(P(s, c.mLit, noon ? poly(M(capLft)) + poly(M(capRgt)) : poly(M(litLeft ? capLft : capRgt))));
  // the weathered pale top on the sun side
  kids.push(P(s, c.mTop, poly(M(litLeft ? [[-11.2, -16], [-9.8, -19.4], [-5.2, -21.4], [1.6, -22], [-0.6, -20.4], [-5.4, -19.4], [-9, -17.6]]
    : noon ? [[-9.8, -19.4], [-5.2, -21.4], [1.6, -22], [7.4, -21.2], [10.6, -19.4], [6.6, -19.6], [1.4, -20.2], [-5, -19.8]]
      : [[1.6, -22], [7.4, -21.2], [10.6, -19.4], [11.8, -16.6], [9.4, -18], [6.4, -19.6], [3, -20.6]]))));
  // the dark undercut where the cap meets the stem
  kids.push(P(s, c.mUnder, poly(M([[-9.2, -11.4], [9.4, -12.4], [11.2, -13.6], [10.8, -13.2], [6, -12.9], [0, -12.6], [-6, -12.4], [-10.8, -12.6]]))));
  // cross-bedding: a set of diagonal hairlines in the cap
  if (c.flute) kids.push(L(s, c.flute, 0.3, line(M([[-8.6, -13.4], [-4.6, -18.4]])) + line(M([[-5.4, -13.2], [-1.4, -18.8]])) + line(M([[3.8, -13.2], [7.4, -18.2]])) + line(M([[6.8, -13.4], [10, -17.4]]))));
  if (c.rim) kids.push(s('path', { fill: 'none', stroke: c.rim, 'stroke-width': 0.6, transform: 'translate(0 0.5)', d: line(M([[-9.8, -19.4], [-5.2, -21.4], [1.6, -22], [7.4, -21.2], [10.6, -19.4], [11.8, -16.6]])) }));

  return kids.flat(Infinity).filter(Boolean);
}
