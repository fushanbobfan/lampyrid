// Natural frequencies for the swarm, in radians per second, centred on zero
// (the common drift is added back only when drawing flashes).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inverse CDFs. `u` is in (0, 1).
export function lorentzianQuantile(u, gamma) {
  return gamma * Math.tan(Math.PI * (u - 0.5));
}

// Acklam's rational approximation to the standard normal quantile
// (relative error below 1.2e-9), scaled by sigma.
export function gaussianQuantile(u, sigma) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let z;
  if (u < lo) {
    const q = Math.sqrt(-2 * Math.log(u));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (u > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - u));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = u - 0.5;
    const r = q * q;
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  return sigma * z;
}

export function uniformQuantile(u, halfWidth) {
  return halfWidth * (2 * u - 1);
}

export const DISTRIBUTIONS = {
  lorentzian: { label: 'Lorentzian (Cauchy)', quantile: lorentzianQuantile },
  gaussian: { label: 'Gaussian', quantile: gaussianQuantile },
  uniform: { label: 'Uniform', quantile: uniformQuantile },
};

// Draw n frequencies. With `even` the quantiles sit at (j + 1/2) / n, which
// removes sampling noise and makes finite swarms follow the n -> infinity
// theory closely; otherwise they are random draws from the seeded generator.
// The Lorentzian has such heavy tails that a few random draws land far out;
// they never lock, which is exactly what the theory expects of them.
export function drawFrequencies(n, { distribution = 'lorentzian', spread = 0.5, seed = 1, even = true } = {}) {
  const dist = DISTRIBUTIONS[distribution];
  if (!dist) throw new Error(`unknown distribution: ${distribution}`);
  const out = new Float64Array(n);
  const rand = mulberry32(seed);
  for (let j = 0; j < n; j++) {
    const u = even ? (j + 0.5) / n : Math.min(1 - 1e-12, Math.max(1e-12, rand()));
    out[j] = dist.quantile(u, spread);
  }
  if (even) shuffle(out, rand);
  return out;
}

// Fisher–Yates, so evenly spaced frequencies are not laid out in order
// across the meadow.
export function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}
