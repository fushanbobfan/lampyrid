import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFrequencies } from '../src/frequencies.js';
import { advanceSweep, couplingLadder, createSweep, sweepProgress } from '../src/sweep.js';
import { steadyOrder } from '../src/theory.js';

test('coupling ladder is evenly spaced and inclusive', () => {
  assert.deepEqual(couplingLadder(0, 2, 5), [0, 0.5, 1, 1.5, 2]);
  assert.deepEqual(couplingLadder(1, 3, 1), [1]);
});

test('sweep records one averaged point per coupling and reports progress', () => {
  const omega = drawFrequencies(100, { spread: 0.5 });
  const sweep = createSweep({ omega, couplings: [0.5, 1.5, 2.5], settle: 2, measure: 1, dt: 0.1 });
  assert.equal(sweepProgress(sweep), 0);
  advanceSweep(sweep, 15);
  assert.equal(sweep.results.length, 0);
  assert.ok(Math.abs(sweepProgress(sweep) - 0.5 / 3) < 1e-12);
  advanceSweep(sweep, 15);
  assert.equal(sweep.results.length, 1);
  assert.equal(sweep.swarm.coupling, 1.5);
  while (!sweep.done) advanceSweep(sweep, 7);
  assert.equal(sweep.results.length, 3);
  assert.equal(sweepProgress(sweep), 1);
  assert.equal(advanceSweep(sweep, 10), 0);
  for (const p of sweep.results) assert.ok(p.r >= 0 && p.r <= 1 && p.spread >= 0);
});

test('a Lorentzian sweep follows sqrt(1 - Kc / K) above threshold', () => {
  const omega = drawFrequencies(1000, { distribution: 'lorentzian', spread: 0.5, seed: 2 });
  const couplings = [0.5, 1.5, 2, 3, 4];
  const sweep = createSweep({ omega, couplings, settle: 30, measure: 20 });
  while (!sweep.done) advanceSweep(sweep, 1e6);
  const [below, ...above] = sweep.results;
  // Finite-N incoherent state: r of order 1 / sqrt(N).
  assert.ok(below.r < 0.1);
  for (const p of above) {
    const want = steadyOrder('lorentzian', 0.5, p.coupling);
    assert.ok(Math.abs(p.r - want) < 0.04, `K=${p.coupling} r=${p.r} theory=${want}`);
  }
});
