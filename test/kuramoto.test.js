import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFrequencies, mulberry32 } from '../src/frequencies.js';
import { buildNeighbours, createSwarm, derivative, measureFrequencies, orderParameter, randomPhases, step } from '../src/kuramoto.js';

function run(swarm, time, dt = 0.05) {
  const steps = Math.round(time / dt);
  for (let s = 0; s < steps; s++) step(swarm, dt);
}

function averageR(swarm, time, dt = 0.05) {
  let sum = 0;
  const steps = Math.round(time / dt);
  for (let s = 0; s < steps; s++) {
    step(swarm, dt);
    sum += orderParameter(swarm.theta).r;
  }
  return sum / steps;
}

test('order parameter is 1 for equal phases and 0 for evenly spread phases', () => {
  assert.ok(Math.abs(orderParameter(new Float64Array(10).fill(1.3)).r - 1) < 1e-12);
  assert.ok(Math.abs(orderParameter(new Float64Array(10).fill(1.3)).psi - 1.3) < 1e-12);
  const spread = Float64Array.from({ length: 12 }, (_, i) => (2 * Math.PI * i) / 12);
  assert.ok(orderParameter(spread).r < 1e-12);
});

test('uncoupled oscillators advance at their own rate', () => {
  const omega = [0.5, -0.25, 1];
  const swarm = createSwarm({ omega, theta: [0, 0, 0], coupling: 0, drift: 0.1 });
  const f = measureFrequencies(swarm, 20, 0.01);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(f[i] - (omega[i] + 0.1)) < 1e-9);
});

test('two oscillators lock at the phase difference asin(dw / K)', () => {
  // Global coupling with N = 2: d(phi)/dt = dw - K sin(phi), so locking
  // needs K >= |dw| and settles at sin(phi) = dw / K.
  const swarm = createSwarm({ omega: [0.3, -0.3], theta: [0, 2], coupling: 1.5 });
  run(swarm, 60, 0.01);
  let phi = swarm.theta[0] - swarm.theta[1];
  phi = Math.atan2(Math.sin(phi), Math.cos(phi));
  assert.ok(Math.abs(phi - Math.asin(0.6 / 1.5)) < 1e-6);
});

test('RK4 step is fourth order on a locked pair', () => {
  const exact = createSwarm({ omega: [0.4, -0.4], theta: [0, 2.5], coupling: 1 });
  run(exact, 4, 1e-4);
  const errAt = (dt) => {
    const s = createSwarm({ omega: [0.4, -0.4], theta: [0, 2.5], coupling: 1 });
    run(s, 4, dt);
    return Math.abs(s.theta[0] - exact.theta[0]);
  };
  const ratio = errAt(0.2) / errAt(0.1);
  assert.ok(ratio > 12 && ratio < 20, `ratio ${ratio}`);
});

test('global coupling below threshold stays incoherent, above it synchronizes', () => {
  const omega = drawFrequencies(800, { distribution: 'lorentzian', spread: 0.5, seed: 3 });
  const phases = randomPhases(800, mulberry32(9));
  // Kc = 2 gamma = 1 for this spread.
  const low = createSwarm({ omega, theta: phases, coupling: 0.6 });
  run(low, 40);
  const high = createSwarm({ omega, theta: phases, coupling: 2 });
  run(high, 40);
  assert.ok(averageR(low, 20) < 0.15);
  const rHigh = averageR(high, 20);
  // Theory: sqrt(1 - Kc / K) = sqrt(0.5) ~ 0.707.
  assert.ok(Math.abs(rHigh - Math.SQRT1_2) < 0.03, `r = ${rHigh}`);
});

test('locked oscillators share the mean frequency; outliers drift', () => {
  const omega = drawFrequencies(400, { distribution: 'lorentzian', spread: 0.5, seed: 4 });
  const swarm = createSwarm({ omega, theta: randomPhases(400, mulberry32(2)), coupling: 2, drift: 0.7 });
  run(swarm, 60);
  const r = orderParameter(swarm.theta).r;
  const f = measureFrequencies(swarm, 40, 0.05);
  for (let i = 0; i < 400; i++) {
    const w = Math.abs(omega[i]);
    // Well inside the locking band |w| <= K r: frequency is the drift.
    if (w < 0.8 * 2 * r) assert.ok(Math.abs(f[i] - 0.7) < 0.02, `w=${omega[i]} f=${f[i]}`);
    // Well outside: it keeps moving relative to the cluster.
    if (w > 1.3 * 2 * r) assert.ok(Math.abs(f[i] - 0.7) > 0.2);
  }
});

test('neighbour lists match a brute-force search and are symmetric', () => {
  const rand = mulberry32(11);
  const n = 300;
  const x = Float64Array.from({ length: n }, rand);
  const y = Float64Array.from({ length: n }, rand);
  const radius = 0.09;
  const { start, index } = buildNeighbours(x, y, radius);
  for (let i = 0; i < n; i++) {
    const got = Array.from(index.subarray(start[i], start[i + 1])).sort((a, b) => a - b);
    const want = [];
    for (let j = 0; j < n; j++) if (j !== i && Math.hypot(x[j] - x[i], y[j] - y[i]) <= radius) want.push(j);
    assert.deepEqual(got, want);
  }
});

test('local coupling to everyone reduces to global coupling', () => {
  const rand = mulberry32(5);
  const n = 60;
  const omega = drawFrequencies(n, { spread: 0.3, seed: 5 });
  const theta = randomPhases(n, rand);
  const x = Float64Array.from({ length: n }, rand);
  const y = Float64Array.from({ length: n }, rand);
  const all = buildNeighbours(x, y, 2);
  // Local form divides by N - 1 (no self term), global by N and includes
  // sin(0) = 0 for itself, so scale K to match.
  const K = 1.2;
  const g = createSwarm({ omega, theta, coupling: K });
  const l = createSwarm({ omega, theta, coupling: (K * (n - 1)) / n, neighbours: all });
  const a = derivative(g, g.theta, new Float64Array(n));
  const b = derivative(l, l.theta, new Float64Array(n));
  for (let i = 0; i < n; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-12);
});

test('an isolated oscillator in local mode runs free', () => {
  const nb = buildNeighbours(Float64Array.of(0.1, 0.9), Float64Array.of(0.1, 0.9), 0.05);
  const swarm = createSwarm({ omega: [0.2, -0.2], theta: [0, 0], coupling: 5, neighbours: nb });
  const f = measureFrequencies(swarm, 10, 0.01);
  assert.ok(Math.abs(f[0] - 0.2) < 1e-9 && Math.abs(f[1] + 0.2) < 1e-9);
});

test('step counts flashes as phases pass zero', () => {
  const swarm = createSwarm({ omega: [0, 0], theta: [6.2, 1], coupling: 0, drift: 1 });
  const flashed = new Uint8Array(2);
  const count = step(swarm, 0.1, flashed);
  assert.equal(count, 1);
  assert.deepEqual(Array.from(flashed), [1, 0]);
  assert.ok(swarm.theta[0] >= 0 && swarm.theta[0] < 2 * Math.PI);
});
