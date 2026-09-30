import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFrequencies, mulberry32 } from '../src/frequencies.js';
import { buildNeighbours, orderParameter, randomPhases } from '../src/kuramoto.js';
import { charge, createPulseSwarm, pulseStep, uncharge } from '../src/pulse.js';

const TAU = 2 * Math.PI;

function run(swarm, seconds, dt = 0.01) {
  let flashes = 0;
  const steps = Math.round(seconds / dt);
  for (let s = 0; s < steps; s++) flashes += pulseStep(swarm, dt);
  return flashes;
}

test('charging curve is concave, pinned at 0 and 1, and inverted exactly', () => {
  for (const b of [0, 0.5, 3, 6]) {
    assert.equal(charge(0, b), 0);
    assert.ok(Math.abs(charge(1, b) - 1) < 1e-12);
    for (const phi of [0.1, 0.37, 0.8]) {
      assert.ok(Math.abs(uncharge(charge(phi, b), b) - phi) < 1e-12);
      if (b > 0) assert.ok(charge(phi, b) > phi);
    }
  }
  // Concavity: midpoint lies above the chord.
  assert.ok(charge(0.5, 3) > (charge(0.2, 3) + charge(0.8, 3)) / 2);
});

test('without pulses every firefly flashes at its own rate', () => {
  const swarm = createPulseSwarm({ omega: [0, 0.5 * Math.PI], theta: [0.01, 0.01], strength: 0, drift: Math.PI });
  const counts = [0, 0];
  const flashed = new Uint8Array(2);
  for (let s = 0; s < 2050; s++) {
    flashed.fill(0);
    pulseStep(swarm, 0.01, flashed);
    counts[0] += flashed[0];
    counts[1] += flashed[1];
  }
  // 20.5 s at 0.5 Hz and 0.75 Hz.
  assert.equal(counts[0], 10);
  assert.equal(counts[1], 15);
});

test('a flash kicks a watcher by exactly strength / k on the charge scale', () => {
  // Drift pi is half a cycle per second, so a 1 ms step adds 0.0005 to phi.
  const swarm = createPulseSwarm({ omega: [0, 0, 0], theta: [TAU * 0.9996, TAU * 0.3, TAU * 0.5], strength: 0.2, curvature: 2 });
  const before = [charge(0.3005, 2), charge(0.5005, 2)];
  pulseStep(swarm, 0.001);
  assert.equal(swarm.theta[0], 0);
  // Global coupling: k = N - 1 = 2.
  assert.ok(Math.abs(charge(swarm.theta[1] / TAU, 2) - before[0] - 0.1) < 1e-6);
  assert.ok(Math.abs(charge(swarm.theta[2] / TAU, 2) - before[1] - 0.1) < 1e-6);
});

test('a kick past the top fires in the same step and cascades', () => {
  // Charges after the 1 ms drift: 1 (fires), 0.99, 0.96, low. Each flash
  // kicks by 0.09 / 3 = 0.03, so firefly 2 needs two waves to reach the top.
  const at = (x) => TAU * (uncharge(x, 3) - 0.0005);
  const swarm = createPulseSwarm({ omega: [0, 0, 0, 0], theta: [TAU * 0.9996, at(0.99), at(0.96), TAU * 0.2], strength: 0.09, curvature: 3 });
  const flashed = new Uint8Array(4);
  const count = pulseStep(swarm, 0.001, flashed);
  // Wave 1: 0 fires and tops up 1. Wave 2: 1's flash pushes 2 over. 3 stays.
  assert.deepEqual(Array.from(flashed), [1, 1, 1, 0]);
  assert.equal(count, 3);
  assert.deepEqual(Array.from(swarm.theta.subarray(0, 3)), [0, 0, 0]);
  assert.ok(swarm.theta[3] > TAU * 0.2);
});

test('identical fireflies with all-to-all pulses end up flashing as one (Mirollo–Strogatz)', () => {
  const n = 200;
  const swarm = createPulseSwarm({ omega: new Float64Array(n), theta: randomPhases(n, mulberry32(4)), strength: 0.2, curvature: 3 });
  run(swarm, 60);
  const flashed = new Uint8Array(n);
  let groups = 0;
  for (let s = 0; s < 300; s++) {
    flashed.fill(0);
    const f = pulseStep(swarm, 0.01, flashed);
    if (f > 0) {
      groups++;
      assert.equal(f, n);
    }
  }
  assert.ok(groups >= 1);
  assert.ok(orderParameter(swarm.theta).r > 0.999);
});

test('a straight charging line gives no synchronizing pull', () => {
  // With b = 0 a kick simply advances the phase, which preserves the gaps
  // between fireflies that never meet; start them well apart and they stay so.
  const swarm = createPulseSwarm({ omega: [0, 0, 0], theta: [0.1, 2.2, 4.3], strength: 0.05, curvature: 0 });
  run(swarm, 40);
  assert.ok(orderParameter(swarm.theta).r < 0.2);
});

test('pulses pull a spread of rhythms into step, and local sight still works', () => {
  const n = 400;
  const omega = drawFrequencies(n, { distribution: 'gaussian', spread: 0.05, seed: 2 });
  const rand = mulberry32(8);
  const x = Float64Array.from({ length: n }, rand);
  const y = Float64Array.from({ length: n }, rand);
  const global = createPulseSwarm({ omega, theta: randomPhases(n, mulberry32(1)), strength: 0.3, curvature: 3 });
  run(global, 80, 0.02);
  assert.ok(orderParameter(global.theta).r > 0.9);

  const lonely = createPulseSwarm({ omega, theta: randomPhases(n, mulberry32(1)), strength: 0.3, curvature: 3, neighbours: buildNeighbours(x, y, 0.001) });
  run(lonely, 40, 0.02);
  assert.ok(orderParameter(lonely.theta).r < 0.2);
});

test('backward-running frequencies are clamped to a slow forward clock', () => {
  const swarm = createPulseSwarm({ omega: [-10], theta: [0.5], strength: 0, drift: Math.PI });
  pulseStep(swarm, 0.1);
  assert.ok(swarm.theta[0] > 0.5);
});
