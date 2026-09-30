// The Kuramoto model. Oscillator i has phase theta_i and natural frequency
// omega_i, and is pulled toward the phases it can see:
//
//   dtheta_i/dt = drift + omega_i + (K / k_i) * sum_j sin(theta_j - theta_i)
//
// With global coupling every oscillator sees all N (k_i = N), and the sum
// collapses onto the order parameter r e^{i psi} = mean of e^{i theta_j}:
//
//   dtheta_i/dt = drift + omega_i + K r sin(psi - theta_i)
//
// which costs O(N) per step. With local coupling each oscillator sees only
// the ones within a radius on the meadow, and k_i is its number of neighbours.

const TAU = 2 * Math.PI;

export function orderParameter(theta) {
  let c = 0;
  let s = 0;
  for (let i = 0; i < theta.length; i++) {
    c += Math.cos(theta[i]);
    s += Math.sin(theta[i]);
  }
  const n = theta.length || 1;
  c /= n;
  s /= n;
  return { r: Math.hypot(c, s), psi: Math.atan2(s, c) };
}

// Neighbour lists in compressed-row form for points in the unit square.
// A uniform grid of buckets keeps it near O(N) for small radii.
export function buildNeighbours(x, y, radius) {
  const n = x.length;
  const cells = Math.max(1, Math.floor(1 / Math.max(radius, 1e-6)));
  const cellOf = (v) => Math.min(cells - 1, Math.max(0, Math.floor(v * cells)));
  const buckets = Array.from({ length: cells * cells }, () => []);
  for (let i = 0; i < n; i++) buckets[cellOf(y[i]) * cells + cellOf(x[i])].push(i);

  const start = new Int32Array(n + 1);
  const list = [];
  const r2 = radius * radius;
  for (let i = 0; i < n; i++) {
    start[i] = list.length;
    const cx = cellOf(x[i]);
    const cy = cellOf(y[i]);
    for (let by = Math.max(0, cy - 1); by <= Math.min(cells - 1, cy + 1); by++) {
      for (let bx = Math.max(0, cx - 1); bx <= Math.min(cells - 1, cx + 1); bx++) {
        for (const j of buckets[by * cells + bx]) {
          if (j === i) continue;
          const dx = x[j] - x[i];
          const dy = y[j] - y[i];
          if (dx * dx + dy * dy <= r2) list.push(j);
        }
      }
    }
  }
  start[n] = list.length;
  return { start, index: Int32Array.from(list) };
}

export function createSwarm({ omega, theta, coupling = 1, drift = 0, neighbours = null } = {}) {
  const n = omega.length;
  const phases = theta ? Float64Array.from(theta) : new Float64Array(n);
  return {
    n,
    omega: Float64Array.from(omega),
    theta: phases,
    coupling,
    drift,
    neighbours,
    time: 0,
    // Scratch space for the four Runge–Kutta stages.
    k: [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)],
    tmp: new Float64Array(n),
  };
}

export function derivative(swarm, theta, out) {
  const { n, omega, coupling: K, drift, neighbours } = swarm;
  if (!neighbours) {
    const { r, psi } = orderParameter(theta);
    const kr = K * r;
    for (let i = 0; i < n; i++) out[i] = drift + omega[i] + kr * Math.sin(psi - theta[i]);
    return out;
  }
  const { start, index } = neighbours;
  for (let i = 0; i < n; i++) {
    const a = start[i];
    const b = start[i + 1];
    let pull = 0;
    if (b > a) {
      const ti = theta[i];
      for (let e = a; e < b; e++) pull += Math.sin(theta[index[e]] - ti);
      pull *= K / (b - a);
    }
    out[i] = drift + omega[i] + pull;
  }
  return out;
}

// One classical fourth-order Runge–Kutta step. Phases are wrapped to
// [0, 2pi) afterwards so they stay small over long runs; the returned count
// is how many oscillators passed phase zero (a flash) during the step.
export function step(swarm, dt, flashed = null) {
  const { n, theta, tmp } = swarm;
  const [k1, k2, k3, k4] = swarm.k;
  derivative(swarm, theta, k1);
  for (let i = 0; i < n; i++) tmp[i] = theta[i] + 0.5 * dt * k1[i];
  derivative(swarm, tmp, k2);
  for (let i = 0; i < n; i++) tmp[i] = theta[i] + 0.5 * dt * k2[i];
  derivative(swarm, tmp, k3);
  for (let i = 0; i < n; i++) tmp[i] = theta[i] + dt * k3[i];
  derivative(swarm, tmp, k4);

  let flashes = 0;
  for (let i = 0; i < n; i++) {
    const next = theta[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    const turns = Math.floor(next / TAU);
    theta[i] = next - turns * TAU;
    if (turns > 0) {
      flashes++;
      if (flashed) flashed[i] = 1;
    }
  }
  swarm.time += dt;
  return flashes;
}

export function randomPhases(n, rand) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = rand() * TAU;
  return out;
}

// Effective frequency of each oscillator over a window: phase advanced per
// unit time, unwrapped. Locked oscillators share one value.
export function measureFrequencies(swarm, duration, dt) {
  const { n, theta } = swarm;
  const total = new Float64Array(n);
  const prev = Float64Array.from(theta);
  const steps = Math.max(1, Math.round(duration / dt));
  for (let s = 0; s < steps; s++) {
    step(swarm, dt);
    for (let i = 0; i < n; i++) {
      let d = theta[i] - prev[i];
      if (d < -Math.PI) d += TAU;
      else if (d > Math.PI) d -= TAU;
      total[i] += d;
      prev[i] = theta[i];
    }
  }
  const span = steps * dt;
  for (let i = 0; i < n; i++) total[i] /= span;
  return total;
}
