import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criticalCoupling, density, erf, lockedFraction, steadyOrder } from '../src/theory.js';

function integrate(f, a, b, m = 20000) {
  const h = (b - a) / m;
  let s = 0;
  for (let j = 0; j <= m; j++) s += (j === 0 || j === m ? 1 : j % 2 ? 4 : 2) * f(a + j * h);
  return (s * h) / 3;
}

test('densities integrate to one', () => {
  assert.ok(Math.abs(integrate((x) => density('gaussian', 0.7, x), -8, 8) - 1) < 1e-9);
  assert.ok(Math.abs(integrate((x) => density('uniform', 0.7, x), -0.7, 0.7) - 1) < 1e-9);
  // Cauchy tails: the mass beyond +-L is (2/pi) atan(gamma / L).
  const L = 400;
  const inside = integrate((x) => density('lorentzian', 0.5, x), -L, L, 400000);
  assert.ok(Math.abs(inside - (1 - (2 / Math.PI) * Math.atan(0.5 / L))) < 1e-6);
});

test('critical couplings match the closed forms', () => {
  assert.ok(Math.abs(criticalCoupling('lorentzian', 0.5) - 1) < 1e-12);
  assert.ok(Math.abs(criticalCoupling('gaussian', 1) - Math.sqrt(8 / Math.PI)) < 1e-12);
  assert.ok(Math.abs(criticalCoupling('uniform', 1) - 4 / Math.PI) < 1e-12);
});

test('the Lorentzian closed form satisfies the self-consistency equation', () => {
  for (const K of [1.2, 2, 5]) {
    const r = steadyOrder('lorentzian', 0.5, K);
    const h = integrate((t) => Math.cos(t) ** 2 * density('lorentzian', 0.5, K * r * Math.sin(t)), -Math.PI / 2, Math.PI / 2, 2000) * K;
    assert.ok(Math.abs(h - 1) < 1e-6, `K=${K} h=${h}`);
  }
});

test('Gaussian order parameter rises continuously from zero and approaches one', () => {
  const Kc = criticalCoupling('gaussian', 1);
  assert.equal(steadyOrder('gaussian', 1, 0.99 * Kc), 0);
  const near = steadyOrder('gaussian', 1, 1.01 * Kc);
  assert.ok(near > 0 && near < 0.2);
  // Near threshold r ~ sqrt(16 (K - Kc) / (pi Kc^4 (-g''(0)))), g''(0) = -1/sqrt(2 pi).
  const mu = 0.001 * Kc;
  const small = steadyOrder('gaussian', 1, Kc + mu);
  const predicted = Math.sqrt((16 * mu) / (Math.PI * Kc ** 4 * (1 / Math.sqrt(2 * Math.PI))));
  assert.ok(Math.abs(small / predicted - 1) < 0.02, `${small} vs ${predicted}`);
  let prev = 0;
  for (let K = 1.7; K < 12; K += 0.5) {
    const r = steadyOrder('gaussian', 1, K);
    assert.ok(r >= prev);
    prev = r;
  }
  assert.ok(prev > 0.98);
});

test('uniform spread jumps straight to r = pi/4 at threshold', () => {
  const Kc = criticalCoupling('uniform', 1);
  assert.equal(steadyOrder('uniform', 1, 0.999 * Kc), 0);
  const r = steadyOrder('uniform', 1, Kc * 1.0000001);
  assert.ok(Math.abs(r - Math.PI / 4) < 1e-3, `r = ${r}`);
  // Everyone is locked once K r >= a; at threshold K r = Kc pi / 4 = a exactly.
  assert.ok(Math.abs(lockedFraction('uniform', 1, Kc * 1.0000001) - 1) < 1e-3);
  // Past threshold the band covers everyone; the root still solves h(r) = 1.
  const K = 3;
  const rr = steadyOrder('uniform', 1, K);
  const h = integrate((t) => Math.cos(t) ** 2 * density('uniform', 1, K * rr * Math.sin(t)), -Math.asin(1 / (K * rr)), Math.asin(1 / (K * rr)), 2000) * K;
  assert.ok(Math.abs(h - 1) < 1e-4);
});

test('locked fraction grows with coupling and stays in [0, 1]', () => {
  for (const dist of ['lorentzian', 'gaussian', 'uniform']) {
    let prev = 0;
    for (let K = 0.2; K < 8; K += 0.3) {
      const f = lockedFraction(dist, 0.5, K);
      assert.ok(f >= prev - 1e-9 && f <= 1 + 1e-9, `${dist} K=${K} f=${f}`);
      prev = f;
    }
  }
  assert.equal(lockedFraction('lorentzian', 0.5, 0.9), 0);
});

test('erf matches reference values', () => {
  assert.ok(Math.abs(erf(0.5) - 0.5204998778) < 2e-7);
  assert.ok(Math.abs(erf(-1.5) + 0.9661051465) < 2e-7);
  assert.equal(erf(0), 0);
});
