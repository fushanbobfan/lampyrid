import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFrequencies, gaussianQuantile, lorentzianQuantile, mulberry32, uniformQuantile } from '../src/frequencies.js';

function median(arr) {
  const s = Array.from(arr).sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

test('mulberry32 replays for the same seed and stays in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('quantiles are symmetric about zero and hit known points', () => {
  assert.ok(Math.abs(lorentzianQuantile(0.5, 2)) < 1e-12);
  assert.ok(Math.abs(lorentzianQuantile(0.75, 2) - 2) < 1e-12);
  assert.ok(Math.abs(gaussianQuantile(0.975, 1) - 1.959963985) < 1e-6);
  assert.ok(Math.abs(gaussianQuantile(0.001, 1) + 3.090232306) < 1e-6);
  assert.ok(Math.abs(gaussianQuantile(0.3, 2) + gaussianQuantile(0.7, 2)) < 1e-9);
  assert.equal(uniformQuantile(1, 3), 3);
  assert.equal(uniformQuantile(0, 3), -3);
});

test('even draws have the right centre and width', () => {
  const lor = drawFrequencies(2000, { distribution: 'lorentzian', spread: 0.5 });
  assert.ok(Math.abs(median(lor)) < 1e-9);
  const abs = Array.from(lor, Math.abs);
  // Half-width at half-maximum: the median of |w| equals gamma.
  assert.ok(Math.abs(median(abs) - 0.5) < 0.01);

  const gau = drawFrequencies(4000, { distribution: 'gaussian', spread: 0.8 });
  const sd = Math.sqrt(gau.reduce((s, w) => s + w * w, 0) / gau.length);
  assert.ok(Math.abs(sd - 0.8) < 0.01);
});

test('random draws replay by seed and differ between seeds', () => {
  const a = drawFrequencies(50, { seed: 7, even: false });
  const b = drawFrequencies(50, { seed: 7, even: false });
  const c = drawFrequencies(50, { seed: 8, even: false });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.every(Number.isFinite));
});

test('even draws are shuffled but keep the same multiset', () => {
  const a = drawFrequencies(100, { seed: 1, distribution: 'uniform', spread: 1 });
  const b = drawFrequencies(100, { seed: 2, distribution: 'uniform', spread: 1 });
  assert.notDeepEqual(a, b);
  assert.deepEqual(Array.from(a).sort(), Array.from(b).sort());
});

test('unknown distribution throws', () => {
  assert.throws(() => drawFrequencies(3, { distribution: 'nope' }), /unknown distribution/);
});
