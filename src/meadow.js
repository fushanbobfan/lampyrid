// Where the fireflies sit and how they look. Pure helpers; drawing happens
// in main.js.

import { mulberry32 } from './frequencies.js';

// Jittered grid in the unit square: even coverage without the clumps of
// pure random placement, and no visible lattice either.
export function placeFireflies(n, seed) {
  const rand = mulberry32(seed ^ 0x5eed);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const [c, r] = cells[i];
    x[i] = (c + 0.1 + 0.8 * rand()) / cols;
    y[i] = (r + 0.1 + 0.8 * rand()) / rows;
  }
  return { x, y };
}

// Brightness from phase: a sharp flash as the phase passes zero, fading
// over the next part of the cycle, dark for the rest.
export function glow(theta, width = 0.45) {
  const t = theta - 2 * Math.PI * Math.floor(theta / (2 * Math.PI));
  return Math.exp(-t / width);
}

// Colour for a natural frequency relative to the spread: slow fireflies
// cool blue-green, fast ones warm amber, central ones pale yellow.
export function frequencyColour(omega, spread) {
  const s = Math.tanh(omega / (2 * spread)); // -1 .. 1
  const cool = [96, 196, 214];
  const mid = [236, 240, 170];
  const warm = [255, 150, 64];
  const [a, b, f] = s < 0 ? [mid, cool, -s] : [mid, warm, s];
  return a.map((v, i) => Math.round(v + (b[i] - v) * f));
}

export function glowColour(level) {
  // Dim olive at rest to hot yellow-green at the flash.
  const lo = [38, 48, 26];
  const hi = [226, 255, 120];
  const f = Math.min(1, Math.max(0, level));
  return lo.map((v, i) => Math.round(v + (hi[i] - v) * f));
}
