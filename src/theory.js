// Infinite-N predictions for globally coupled swarms with a symmetric,
// unimodal frequency density g. In the steady state an oscillator with
// |omega| <= K r locks at sin(theta - psi) = omega / (K r); the rest drift
// and, by symmetry, add nothing to the order parameter. Self-consistency:
//
//   r = K r * integral_{-pi/2}^{pi/2} cos^2(t) g(K r sin t) dt
//
// Kuramoto's threshold falls out as r -> 0: Kc = 2 / (pi g(0)).

export function density(distribution, spread, x) {
  switch (distribution) {
    case 'lorentzian':
      return spread / (Math.PI * (x * x + spread * spread));
    case 'gaussian':
      return Math.exp(-(x * x) / (2 * spread * spread)) / (spread * Math.sqrt(2 * Math.PI));
    case 'uniform':
      return Math.abs(x) <= spread ? 1 / (2 * spread) : 0;
    default:
      throw new Error(`unknown distribution: ${distribution}`);
  }
}

export function criticalCoupling(distribution, spread) {
  return 2 / (Math.PI * density(distribution, spread, 0));
}

// K times the locked-oscillator integral. The steady r solves h(r) = 1.
function lockedIntegral(distribution, spread, K, r) {
  const kr = K * r;
  // For the uniform density the integrand is zero past |sin t| = a / (K r);
  // integrating only up to that angle keeps Simpson's rule accurate.
  const top = distribution === 'uniform' && kr > spread ? Math.asin(spread / kr) : Math.PI / 2;
  const m = 400;
  const h = (2 * top) / m;
  let sum = 0;
  for (let j = 0; j <= m; j++) {
    const t = -top + j * h;
    const c = Math.cos(t);
    const w = j === 0 || j === m ? 1 : j % 2 ? 4 : 2;
    sum += w * c * c * density(distribution, spread, kr * Math.sin(t));
  }
  return (K * sum * h) / 3;
}

// Steady-state order parameter for coupling K, zero below threshold.
// The Lorentzian has Kuramoto's closed form; the others are solved by
// bisection, since h(r) falls monotonically from K / Kc toward below 1.
export function steadyOrder(distribution, spread, K) {
  const Kc = criticalCoupling(distribution, spread);
  if (K <= Kc) return 0;
  if (distribution === 'lorentzian') return Math.sqrt(1 - Kc / K);
  let lo = 0;
  let hi = 1;
  for (let it = 0; it < 60; it++) {
    const mid = 0.5 * (lo + hi);
    if (lockedIntegral(distribution, spread, K, mid) > 1) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// Fraction of the swarm inside the locking band |omega| <= K r.
export function lockedFraction(distribution, spread, K) {
  const band = K * steadyOrder(distribution, spread, K);
  if (band === 0) return 0;
  switch (distribution) {
    case 'lorentzian':
      return (2 / Math.PI) * Math.atan(band / spread);
    case 'gaussian':
      return erf(band / (spread * Math.SQRT2));
    case 'uniform':
      return Math.min(1, band / spread);
    default:
      throw new Error(`unknown distribution: ${distribution}`);
  }
}

// Abramowitz and Stegun 7.1.26, absolute error below 1.5e-7.
export function erf(x) {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
