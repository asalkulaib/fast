// Guards for the Nafud theme and the copy rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('docs');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(css|js|html|webmanifest|svg)$/.test(name)) files.push(full);
  }
})(root);
const read = (f) => readFileSync(f, 'utf8');
const rel = (f) => path.relative(root, f);
const css = read(path.join(root, 'css', 'app.css'));

const PALETTE = {
  '--bg': '#05060B', '--bg-raised': '#16120E', '--bg-raised-2': '#1C1409',
  '--text-display': '#F6E7CB', '--text-body': '#E4D2B2', '--text-quiet': '#A9957B',
  '--text-label': '#C79B5C', '--text-marginalia': '#6E5C45',
  '--accent': '#F0B25C', '--accent-strong': '#C8913F', '--clay': '#9E3B23', '--rule': '#E0AE5B',
  '--rock-400': '#C58E50', '--rock-500': '#9C6832', '--rock-700': '#4B2E14', '--sand-600': '#5E3B18',
};

test('the colour tokens are exactly the brief', () => {
  for (const [name, hex] of Object.entries(PALETTE)) {
    assert.match(css, new RegExp(`${name}:\\s*${hex};`, 'i'), name);
  }
  assert.match(css, /--rule-quiet:\s*rgba\(224, 174, 91, 0\.4\);/);
});

test('no colour outside the palette anywhere', () => {
  const allowed = new Set(Object.values(PALETTE).map((h) => h.toLowerCase()));
  for (const f of files) {
    for (const [hex] of read(f).matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      assert.ok(allowed.has(hex.toLowerCase()), `${rel(f)} uses ${hex}`);
    }
    for (const [rgba] of read(f).matchAll(/rgba\(([^)]*)\)/g)) {
      assert.match(rgba, /rgba\((224, 174, 91|5, 6, 11), 0?\.\d+\)/, `${rel(f)} uses ${rgba}`);
    }
  }
});

test('square corners, no shadows, gradients, glass or banned fonts', () => {
  for (const f of files.filter((x) => /\.(css|js|html)$/.test(x))) {
    const text = read(f);
    for (const [decl] of text.matchAll(/border-radius\s*:\s*([^;]+);/g)) assert.match(decl, /:\s*0;/, `${rel(f)}: ${decl}`);
    assert.doesNotMatch(text, /box-shadow|text-shadow|drop-shadow/, rel(f));
    assert.doesNotMatch(text, /gradient\(/, rel(f));
    assert.doesNotMatch(text, /backdrop-filter|filter:\s*blur/, rel(f));
    assert.doesNotMatch(text, /\bInter\b|Geist|Space Grotesk/, rel(f));
  }
});

test('copy: no em dashes, emojis, checkmarks or "it\'s not X, it\'s Y"', () => {
  const copyFiles = [...files, path.resolve('README.md')];
  for (const f of copyFiles) {
    const text = read(f);
    assert.doesNotMatch(text, /—/, `${rel(f)} has an em dash`);
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, `${rel(f)} has an emoji`);
    assert.doesNotMatch(text, /[✓✔✅]/, `${rel(f)} has a checkmark`);
    assert.doesNotMatch(text, /\bit'?s not [^.]{1,40}, it'?s\b/i, `${rel(f)} uses the "it's not X, it's Y" pattern`);
  }
});

test('nothing loads from another origin', () => {
  for (const f of files) {
    const urls = [...read(f).matchAll(/https?:\/\/[^\s'")]+/g)].map((m) => m[0]);
    for (const u of urls) assert.equal(u, 'http://www.w3.org/2000/svg', `${rel(f)} references ${u}`);
  }
});

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test('text contrast on night and ink', () => {
  const grounds = [PALETTE['--bg'], PALETTE['--bg-raised'], PALETTE['--bg-raised-2']];
  for (const token of ['--text-display', '--text-body', '--text-quiet', '--text-label', '--accent']) {
    for (const g of grounds) assert.ok(contrast(PALETTE[token], g) >= 4.5, `${token} on ${g}: ${contrast(PALETTE[token], g).toFixed(2)}`);
  }
  // The pressed primary button: night text on gold.
  assert.ok(contrast(PALETTE['--bg'], PALETTE['--accent']) >= 4.5);
  // Clay passes only for large text (3:1), so it is used at 24px and above.
  const clay = contrast(PALETTE['--clay'], PALETTE['--bg']);
  assert.ok(clay >= 2.95 && clay < 4.5, `clay ${clay.toFixed(2)}`);
  // Marginalia colour is decorative only.
  assert.ok(contrast(PALETTE['--text-marginalia'], PALETTE['--bg']) < 4.5);
});

test('clay is only ever set on large text classes', () => {
  for (const f of files.filter((x) => x.endsWith('.js'))) {
    for (const [cls] of read(f).matchAll(/class: [`'"]([^`'"]*\bclay\b[^`'"]*)[`'"]/g)) {
      assert.match(cls, /statement|display|figure|\$\{/, `${rel(f)}: ${cls}`);
    }
  }
});
