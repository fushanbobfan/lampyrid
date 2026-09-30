// Scene settings, their ranges, presets and the compact form used in share links.

export const RANGES = {
  global: 'Everyone sees everyone',
  local: 'Only nearby fireflies',
};

export const STYLES = {
  smooth: 'Smooth pull (Kuramoto)',
  pulse: 'Flash pulses (Mirollo–Strogatz)',
};

export const COLOURINGS = {
  glow: 'Flash glow',
  frequency: 'Natural frequency',
};

export const SPECS = {
  style: { key: 's', values: Object.keys(STYLES) },
  coupling: { key: 'k', min: 0, max: 4, step: 0.05 },
  strength: { key: 'e', min: 0, max: 0.5, step: 0.01 },
  curvature: { key: 'b', min: 0, max: 6, step: 0.1 },
  spread: { key: 'w', min: 0.02, max: 1, step: 0.01 },
  distribution: { key: 'd', values: ['lorentzian', 'gaussian', 'uniform'] },
  count: { key: 'n', min: 50, max: 1500, step: 10 },
  range: { key: 'g', values: Object.keys(RANGES) },
  radius: { key: 'a', min: 0.04, max: 0.5, step: 0.01 },
  sampling: { key: 'q', values: ['even', 'random'] },
  seed: { key: 'r', min: 1, max: 999999, step: 1 },
  colouring: { key: 'c', values: Object.keys(COLOURINGS) },
};

export const DEFAULTS = {
  style: 'smooth', coupling: 1.6, strength: 0.12, curvature: 3, spread: 0.5, distribution: 'lorentzian', count: 600, range: 'global', radius: 0.12,
  sampling: 'even', seed: 1, colouring: 'glow',
};

export const PRESETS = {
  twilight: {
    label: 'Twilight: too weak to sync',
    note: 'Coupling is below the threshold, so every firefly keeps its own time. The order parameter hovers near zero.',
    params: { coupling: 0.6, spread: 0.5, distribution: 'lorentzian', range: 'global' },
  },
  threshold: {
    label: 'On the edge',
    note: 'Just above the threshold. A small cluster forms and wanders; the order parameter fluctuates a lot.',
    params: { coupling: 1.15, spread: 0.5, distribution: 'lorentzian', range: 'global' },
  },
  chorus: {
    label: 'Chorus',
    note: 'Well above threshold. Most of the meadow locks into one rhythm; only the fastest and slowest fireflies drift.',
    params: { coupling: 2.4, spread: 0.5, distribution: 'lorentzian', range: 'global' },
  },
  snap: {
    label: 'Snap: uniform rhythms',
    note: 'With a flat spread of rhythms and no stragglers, synchrony arrives all at once: r jumps from zero to pi/4 at the threshold.',
    params: { coupling: 1.4, spread: 1, distribution: 'uniform', range: 'global' },
  },
  waves: {
    label: 'Waves in the grass',
    note: 'Each firefly sees only its neighbours. Patches lock separately and flashes roll across the meadow as waves.',
    params: { coupling: 3, spread: 0.15, distribution: 'gaussian', range: 'local', radius: 0.07, count: 1200 },
  },
  flashes: {
    label: 'Flash pulses',
    note: 'Closer to real fireflies: nobody sees a smooth phase, only flashes. Each flash jolts the watchers ahead, and groups that flash together stay together for good.',
    params: { style: 'pulse', strength: 0.12, curvature: 3, spread: 0.05, distribution: 'gaussian', range: 'global' },
  },
  rivals: {
    label: 'Rival swarms',
    note: 'Flash pulses seen only nearby. Neighbourhoods fall into step on their own, and big rival groups end up flashing at different moments.',
    params: { style: 'pulse', strength: 0.1, curvature: 3, spread: 0.05, distribution: 'gaussian', range: 'local', radius: 0.07, count: 1200 },
  },
};

export function clampParam(name, value) {
  const spec = SPECS[name];
  if (spec.values) return spec.values.includes(value) ? value : DEFAULTS[name];
  const v = typeof value === 'string' ? Number(value) : value;
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULTS[name];
  const stepped = Math.round(v / spec.step) * spec.step;
  const clamped = Math.min(spec.max, Math.max(spec.min, stepped));
  // Trim float noise from the step multiplication (0.15000000000000002).
  return Number(clamped.toFixed(6));
}

export function normalize(p) {
  const out = {};
  for (const name of Object.keys(SPECS)) out[name] = clampParam(name, p[name] ?? DEFAULTS[name]);
  return out;
}

export function applyPreset(name, current = DEFAULTS) {
  const preset = PRESETS[name];
  if (!preset) return normalize(current);
  return normalize({ ...DEFAULTS, seed: current.seed, colouring: current.colouring, ...preset.params });
}

export function encodeParams(p) {
  return Object.entries(SPECS).map(([name, spec]) => `${spec.key}=${p[name]}`).join('&');
}

// Returns null when the text carries none of our keys.
export function decodeParams(text) {
  const q = new URLSearchParams(String(text || '').replace(/^[#?]/, ''));
  let seen = false;
  const raw = {};
  for (const [name, spec] of Object.entries(SPECS)) {
    if (q.has(spec.key)) {
      seen = true;
      raw[name] = q.get(spec.key);
    }
  }
  return seen ? normalize(raw) : null;
}
