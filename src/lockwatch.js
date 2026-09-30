// Which fireflies are locked to the crowd right now? Sample each phase
// relative to the mean phase psi at a fixed interval and keep the last few
// seconds of slips. A locked firefly holds a fixed offset from psi, so its
// relative phase barely moves; a drifting one slips by whole turns.

import { orderParameter } from './kuramoto.js';

const TAU = 2 * Math.PI;

function wrap(a) {
  return a - TAU * Math.floor((a + Math.PI) / TAU);
}

export function createLockWatch(n, { samples = 32, tolerance = Math.PI / 2 } = {}) {
  return {
    n,
    samples,
    tolerance,
    prev: null,
    ring: new Float64Array(n * samples),
    total: new Float64Array(n),
    slot: 0,
    filled: 0,
  };
}

// Call at a steady interval with the current phases.
export function sampleLockWatch(watch, theta) {
  const { psi } = orderParameter(theta);
  const { n, samples, ring, total } = watch;
  if (!watch.prev) {
    watch.prev = Float64Array.from(theta, (t) => wrap(t - psi));
    return;
  }
  const base = watch.slot * n;
  for (let i = 0; i < n; i++) {
    const rel = wrap(theta[i] - psi);
    const inc = wrap(rel - watch.prev[i]);
    watch.prev[i] = rel;
    total[i] += inc - ring[base + i];
    ring[base + i] = inc;
  }
  watch.slot = (watch.slot + 1) % samples;
  if (watch.filled < samples) watch.filled++;
}

export function isReady(watch) {
  return watch.filled >= watch.samples;
}

export function lockedMask(watch, out = new Uint8Array(watch.n)) {
  for (let i = 0; i < watch.n; i++) out[i] = Math.abs(watch.total[i]) < watch.tolerance ? 1 : 0;
  return out;
}

export function lockedShare(watch) {
  let count = 0;
  for (let i = 0; i < watch.n; i++) if (Math.abs(watch.total[i]) < watch.tolerance) count++;
  return count / watch.n;
}
