import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPreset, clampParam, decodeParams, DEFAULTS, encodeParams, normalize, PRESETS, SPECS } from '../src/params.js';

test('defaults are already normalized', () => {
  assert.deepEqual(normalize(DEFAULTS), DEFAULTS);
});

test('numbers are clamped, stepped and cleaned of float noise', () => {
  assert.equal(clampParam('coupling', 9), 4);
  assert.equal(clampParam('coupling', -1), 0);
  assert.equal(clampParam('coupling', '1.23'), 1.25);
  assert.equal(clampParam('spread', 0.149), 0.15);
  assert.equal(clampParam('spread', 0.001), 0.02);
  assert.equal(clampParam('count', 57), 60);
  assert.equal(clampParam('count', 'abc'), DEFAULTS.count);
  assert.equal(clampParam('distribution', 'weird'), DEFAULTS.distribution);
});

test('share links round-trip and ignore foreign text', () => {
  const p = normalize({ ...DEFAULTS, coupling: 2.35, range: 'local', radius: 0.21, seed: 4242, sampling: 'random' });
  assert.deepEqual(decodeParams('#' + encodeParams(p)), p);
  assert.equal(decodeParams('#foo=1'), null);
  assert.equal(decodeParams(''), null);
  const partial = decodeParams('?k=3');
  assert.equal(partial.coupling, 3);
  assert.equal(partial.count, DEFAULTS.count);
});

test('every spec has a unique link key', () => {
  const keys = Object.values(SPECS).map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('presets produce valid settings and keep the seed and colouring', () => {
  for (const name of Object.keys(PRESETS)) {
    const p = applyPreset(name, { ...DEFAULTS, seed: 77, colouring: 'frequency' });
    assert.deepEqual(normalize(p), p);
    assert.equal(p.seed, 77);
    assert.equal(p.colouring, 'frequency');
    for (const [k, v] of Object.entries(PRESETS[name].params)) assert.equal(p[k], v, `${name}.${k}`);
  }
});

test('links from before pulse coupling open in the smooth style', () => {
  const old = decodeParams('#k=2.35&w=0.5&d=lorentzian&n=600&g=global&a=0.12&q=even&r=1&c=glow');
  assert.equal(old.style, 'smooth');
  assert.equal(old.strength, DEFAULTS.strength);
  assert.equal(old.coupling, 2.35);
  assert.equal(clampParam('strength', 0.7), 0.5);
  assert.equal(clampParam('curvature', 2.34), 2.3);
});
