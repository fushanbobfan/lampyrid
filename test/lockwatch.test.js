import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFrequencies, mulberry32 } from '../src/frequencies.js';
import { createSwarm, randomPhases, step } from '../src/kuramoto.js';
import { createLockWatch, isReady, lockedMask, lockedShare, sampleLockWatch } from '../src/lockwatch.js';
import { lockedFraction } from '../src/theory.js';

function watchRun(swarm, watch, seconds, dt = 0.05, every = 0.25) {
  const per = Math.round(every / dt);
  const steps = Math.round(seconds / dt);
  for (let s = 1; s <= steps; s++) {
    step(swarm, dt);
    if (s % per === 0) sampleLockWatch(watch, swarm.theta);
  }
}

test('a watch needs a full window before it is ready', () => {
  const watch = createLockWatch(3, { samples: 4 });
  const theta = new Float64Array(3);
  for (let i = 0; i < 4; i++) {
    assert.ok(!isReady(watch));
    sampleLockWatch(watch, theta);
  }
  assert.ok(!isReady(watch));
  sampleLockWatch(watch, theta);
  assert.ok(isReady(watch));
  assert.equal(lockedShare(watch), 1);
});

test('a rigidly rotating crowd is locked; a lone fast runner is not', () => {
  const omega = new Float64Array(20);
  omega[7] = 1.5;
  const swarm = createSwarm({ omega, theta: new Float64Array(20), coupling: 0, drift: 2 });
  const watch = createLockWatch(20);
  watchRun(swarm, watch, 12);
  const mask = lockedMask(watch);
  assert.equal(mask[7], 0);
  assert.equal(mask.reduce((a, b) => a + b, 0), 19);
});

test('measured locked share tracks the Lorentzian prediction', () => {
  const n = 1000;
  const omega = drawFrequencies(n, { distribution: 'lorentzian', spread: 0.5, seed: 6 });
  const swarm = createSwarm({ omega, theta: randomPhases(n, mulberry32(3)), coupling: 2, drift: Math.PI });
  for (let s = 0; s < 800; s++) step(swarm, 0.05);
  const watch = createLockWatch(n);
  watchRun(swarm, watch, 10);
  assert.ok(isReady(watch));
  const want = lockedFraction('lorentzian', 0.5, 2);
  // The slip tolerance also admits a few slow drifters near the band edge.
  const got = lockedShare(watch);
  assert.ok(got >= want - 0.03 && got <= want + 0.08, `got ${got} want ${want}`);
});
