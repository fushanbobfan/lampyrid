import { createTrace, linearScale, niceTicks, pushTrace, traceValues } from './chart.js';
import { drawFrequencies, mulberry32 } from './frequencies.js';
import { buildNeighbours, createSwarm, orderParameter, randomPhases, step } from './kuramoto.js';
import { createLockWatch, isReady, lockedMask, lockedShare, sampleLockWatch } from './lockwatch.js';
import { frequencyColour, glow, glowColour, placeFireflies } from './meadow.js';
import { applyPreset, COLOURINGS, decodeParams, DEFAULTS, encodeParams, normalize, PRESETS, RANGES, STYLES } from './params.js';
import { createPulseSwarm, pulseStep } from './pulse.js';
import { advanceSweep, couplingLadder, createSweep, sweepProgress } from './sweep.js';
import { criticalCoupling, lockedFraction, steadyOrder } from './theory.js';

const TAU = 2 * Math.PI;
const DRIFT = Math.PI; // shared rhythm: one flash every two seconds
const DT = 0.02;
const SAMPLE_EVERY = 0.25; // seconds between lock-watch and trace samples
const TRACE_SECONDS = 40;
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];
const K_MAX = 4;
const PULSE_SWEEP_NOTE = 'Sweeps step the smooth coupling K; switch back to the smooth pull to run one.';

const $ = (id) => document.getElementById(id);
const els = {
  meadow: $('meadow'), circle: $('circle'), trace: $('trace'), sweep: $('sweep'),
  status: $('status'), play: $('play'), restart: $('restart'),
  preset: $('preset'), presetNote: $('preset-note'),
  style: $('style'), couplingRow: $('coupling-row'), pulseRows: $('pulse-rows'),
  coupling: $('coupling'), couplingValue: $('coupling-value'), threshold: $('threshold'),
  strength: $('strength'), strengthValue: $('strength-value'), curvature: $('curvature'), curvatureValue: $('curvature-value'),
  distribution: $('distribution'), spread: $('spread'), spreadValue: $('spread-value'),
  count: $('count'), countValue: $('count-value'), sampling: $('sampling'),
  range: $('range'), radius: $('radius'), radiusValue: $('radius-value'), radiusRow: $('radius-row'),
  seedValue: $('seed-value'), reseed: $('reseed'), speed: $('speed'), speedValue: $('speed-value'),
  runSweep: $('run-sweep'), sweepNote: $('sweep-note'),
  colouring: $('colouring'), copyLink: $('copy-link'), save: $('save'),
};

let params = decodeParams(location.hash) || { ...DEFAULTS };
let running = true;
let sim = null;
let sweep = null;
let sweepResult = null;
let lastFrame = 0;
let sinceSample = 0;

// ---------------------------------------------------------------- setup

function fillSelect(select, entries) {
  select.replaceChildren(...Object.entries(entries).map(([value, label]) => new Option(label, value)));
}

fillSelect(els.style, STYLES);
fillSelect(els.range, RANGES);
fillSelect(els.colouring, COLOURINGS);
fillSelect(els.preset, { custom: 'Custom', ...Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.label])) });

function build({ keepPhases = false } = {}) {
  const n = params.count;
  const omega = drawFrequencies(n, {
    distribution: params.distribution, spread: params.spread, seed: params.seed, even: params.sampling === 'even',
  });
  const spots = placeFireflies(n, params.seed);
  const neighbours = params.range === 'local' ? buildNeighbours(spots.x, spots.y, params.radius) : null;
  const theta = keepPhases && sim && sim.swarm.n === n ? sim.swarm.theta : randomPhases(n, mulberry32(params.seed * 7919 + 1));
  const swarm = params.style === 'pulse'
    ? createPulseSwarm({ omega, theta, strength: params.strength, curvature: params.curvature, drift: DRIFT, neighbours })
    : createSwarm({ omega, theta, coupling: params.coupling, drift: DRIFT, neighbours });
  sim = {
    swarm,
    spots,
    frame: keepPhases && sim ? sim.frame : 0,
    watch: createLockWatch(n),
    locked: new Uint8Array(n),
    trace: keepPhases && sim ? sim.trace : createTrace(Math.round(TRACE_SECONDS / SAMPLE_EVERY)),
    colours: Array.from(omega, (w) => frequencyColour(w, params.spread)),
  };
  sinceSample = 0;
}

function scatter() {
  sim.swarm.theta.set(randomPhases(sim.swarm.n, mulberry32((Math.random() * 2 ** 32) >>> 0)));
  sim.watch = createLockWatch(sim.swarm.n);
  sim.locked.fill(0);
}

function startle(px, py) {
  const { x, y } = sim.spots;
  const rand = mulberry32((Math.random() * 2 ** 32) >>> 0);
  const r2 = 0.08 * 0.08;
  for (let i = 0; i < sim.swarm.n; i++) {
    const dx = x[i] - px;
    const dy = y[i] - py;
    if (dx * dx + dy * dy < r2) sim.swarm.theta[i] = rand() * TAU;
  }
}

// The infinite-meadow predictions cover smooth coupling with everyone in sight.
function hasTheory() {
  return params.style === 'smooth' && params.range === 'global';
}

// ---------------------------------------------------------------- controls

function matchingPreset() {
  for (const [name] of Object.entries(PRESETS)) {
    const p = applyPreset(name, params);
    if (Object.keys(p).every((k) => p[k] === params[k])) return name;
  }
  return 'custom';
}

function syncControls() {
  const pulse = params.style === 'pulse';
  els.style.value = params.style;
  els.couplingRow.hidden = pulse;
  els.pulseRows.hidden = !pulse;
  els.strength.value = params.strength;
  els.strengthValue.textContent = params.strength.toFixed(2);
  els.curvature.value = params.curvature;
  els.curvatureValue.textContent = params.curvature.toFixed(1);
  els.runSweep.disabled = pulse || Boolean(sweep);
  if (pulse) els.sweepNote.textContent = PULSE_SWEEP_NOTE;
  else if (els.sweepNote.textContent === PULSE_SWEEP_NOTE) els.sweepNote.textContent = '';
  els.coupling.value = params.coupling;
  els.couplingValue.textContent = params.coupling.toFixed(2);
  els.distribution.value = params.distribution;
  els.spread.value = params.spread;
  els.spreadValue.textContent = params.spread.toFixed(2);
  els.count.value = params.count;
  els.countValue.textContent = params.count;
  els.sampling.value = params.sampling;
  els.range.value = params.range;
  els.radius.value = params.radius;
  els.radiusValue.textContent = params.radius.toFixed(2);
  els.radiusRow.hidden = params.range !== 'local';
  els.seedValue.textContent = params.seed;
  els.colouring.value = params.colouring;
  const preset = matchingPreset();
  els.preset.value = preset;
  els.presetNote.textContent = preset === 'custom' ? '' : PRESETS[preset].note;
  const Kc = criticalCoupling(params.distribution, params.spread);
  if (params.range === 'global') {
    const side = params.coupling > Kc ? 'above' : 'below';
    els.threshold.textContent = `Threshold Kc = ${Kc.toFixed(2)}; you are ${side} it.`;
  } else {
    els.threshold.textContent = `With everyone in sight the threshold would be Kc = ${Kc.toFixed(2)}; with local sight there is no simple formula.`;
  }
  const speed = SPEEDS[Number(els.speed.value)];
  els.speedValue.textContent = `${speed}×`;
}

function setParams(next, how) {
  const prev = params;
  params = normalize(next);
  if (how === 'coupling') sim.swarm.coupling = params.coupling;
  else if (how === 'pulse') {
    sim.swarm.strength = params.strength;
    sim.swarm.curvature = params.curvature;
  }
  else if (how === 'view') {
    // nothing to rebuild
  } else if (how === 'range' || how === 'style') build({ keepPhases: true });
  else build();
  const sweepStale = ['style', 'distribution', 'spread', 'range', 'radius', 'count', 'seed', 'sampling'].some((k) => prev[k] !== params[k]);
  if (sweepStale && (sweepResult || sweep)) {
    // A sweep belongs to the swarm it was run on; drop it once that changes.
    sweepResult = null;
    sweep = null;
    els.runSweep.disabled = false;
    els.sweepNote.textContent = '';
  }
  syncControls();
  drawSweep();
}

function onRange(input, name, how) {
  input.addEventListener('input', () => setParams({ ...params, [name]: Number(input.value) }, how));
}

onRange(els.coupling, 'coupling', 'coupling');
onRange(els.strength, 'strength', 'pulse');
onRange(els.curvature, 'curvature', 'pulse');
onRange(els.spread, 'spread', 'rebuild');
onRange(els.count, 'count', 'rebuild');
onRange(els.radius, 'radius', 'range');
els.style.addEventListener('change', () => setParams({ ...params, style: els.style.value }, 'style'));
els.distribution.addEventListener('change', () => setParams({ ...params, distribution: els.distribution.value }, 'rebuild'));
els.sampling.addEventListener('change', () => setParams({ ...params, sampling: els.sampling.value }, 'rebuild'));
els.range.addEventListener('change', () => setParams({ ...params, range: els.range.value }, 'range'));
els.colouring.addEventListener('change', () => setParams({ ...params, colouring: els.colouring.value }, 'view'));
els.preset.addEventListener('change', () => {
  if (els.preset.value === 'custom') return;
  setParams(applyPreset(els.preset.value, params), 'rebuild');
});
els.reseed.addEventListener('click', () => setParams({ ...params, seed: 1 + Math.floor(Math.random() * 999999) }, 'rebuild'));
els.speed.addEventListener('input', syncControls);

function togglePlay() {
  running = !running;
  els.play.textContent = running ? 'Pause' : 'Play';
  els.play.setAttribute('aria-pressed', String(running));
}

els.play.addEventListener('click', togglePlay);
els.restart.addEventListener('click', scatter);
els.runSweep.addEventListener('click', startSweep);

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'r' || e.key === 'R') scatter();
  else if (e.key === 's' || e.key === 'S') startSweep();
});

function pointerToMeadow(e) {
  const rect = els.meadow.getBoundingClientRect();
  const { ox, oy, side } = meadowBox();
  const dpr = els.meadow.width / rect.width;
  return [((e.clientX - rect.left) * dpr - ox) / side, ((e.clientY - rect.top) * dpr - oy) / side];
}

let dragging = false;
els.meadow.addEventListener('pointerdown', (e) => {
  dragging = true;
  els.meadow.setPointerCapture(e.pointerId);
  startle(...pointerToMeadow(e));
});
els.meadow.addEventListener('pointermove', (e) => {
  if (dragging) startle(...pointerToMeadow(e));
});
els.meadow.addEventListener('pointerup', () => { dragging = false; });
els.meadow.addEventListener('pointercancel', () => { dragging = false; });

els.copyLink.addEventListener('click', async () => {
  const hash = '#' + encodeParams(params);
  history.replaceState(null, '', hash);
  try {
    await navigator.clipboard.writeText(location.href);
    els.copyLink.textContent = 'Copied';
  } catch {
    els.copyLink.textContent = 'Link in address bar';
  }
  setTimeout(() => { els.copyLink.textContent = 'Copy link'; }, 1600);
});

els.save.addEventListener('click', () => {
  els.meadow.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lampyrid-k${params.coupling.toFixed(2)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

// ---------------------------------------------------------------- sweep

function startSweep() {
  if (params.style !== 'smooth' || sweep) return;
  const omega = sim.swarm.omega;
  const neighbours = sim.swarm.neighbours;
  sweep = createSweep({ omega, couplings: couplingLadder(0, K_MAX, 21), seed: params.seed, dt: 0.05, settle: 25, measure: 15, neighbours });
  sweepResult = null;
  els.runSweep.disabled = true;
  els.sweepNote.textContent = 'Sweeping…';
}

function runSweepSlice(budgetMs) {
  if (!sweep) return;
  const until = performance.now() + budgetMs;
  while (!sweep.done && performance.now() < until) advanceSweep(sweep, 20);
  if (sweep.done) {
    sweepResult = { points: sweep.results, distribution: params.distribution, spread: params.spread, range: params.range, n: sim.swarm.n };
    sweep = null;
    els.runSweep.disabled = false;
    describeSweep();
  } else {
    els.sweepNote.textContent = `Sweeping… ${Math.round(sweepProgress(sweep) * 100)}%`;
  }
  drawSweep();
}

function describeSweep() {
  const pts = sweepResult.points;
  if (sweepResult.range !== 'global') {
    els.sweepNote.textContent = `Swept ${pts.length} couplings with local sight. The prediction assumes everyone sees everyone, so expect the points to sit lower.`;
    return;
  }
  let worst = 0;
  for (const p of pts) {
    const want = steadyOrder(sweepResult.distribution, sweepResult.spread, p.coupling);
    if (want > 0) worst = Math.max(worst, Math.abs(p.r - want));
  }
  els.sweepNote.textContent = `Swept ${pts.length} couplings with ${sweepResult.n} fireflies. Above the threshold the points stay within ${worst.toFixed(3)} of the prediction.`;
}

// ---------------------------------------------------------------- drawing

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
}

function meadowBox() {
  const { width, height } = els.meadow;
  const side = Math.min(width, height);
  return { ox: (width - side) / 2, oy: (height - side) / 2, side };
}

function drawMeadow() {
  const canvas = els.meadow;
  fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#050a0e');
  sky.addColorStop(1, '#08120a');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const { ox, oy, side } = meadowBox();
  const { swarm, spots, colours } = sim;
  const n = swarm.n;
  const dot = Math.max(1.2, side / Math.sqrt(n) / 7);
  const byFrequency = params.colouring === 'frequency';

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const level = glow(swarm.theta[i]);
    const px = ox + spots.x[i] * side;
    const py = oy + spots.y[i] * side;
    const [r, g, b] = byFrequency ? colours[i] : glowColour(level);
    const bright = byFrequency ? 0.25 + 0.75 * level : 1;
    if (level > 0.08) {
      ctx.fillStyle = `rgba(${r},${g},${b},${0.16 * level})`;
      ctx.beginPath();
      ctx.arc(px, py, dot * (2.5 + 4 * level), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(${r},${g},${b},${bright})`;
    ctx.beginPath();
    ctx.arc(px, py, dot, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawCircle(r, psi) {
  const canvas = els.circle;
  fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) * 0.4;
  ctx.strokeStyle = '#26362a';
  ctx.lineWidth = Math.max(1, width / 300);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();

  const want = hasTheory() ? steadyOrder(params.distribution, params.spread, params.coupling) : 0;
  if (want > 0) {
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = '#6f8a63';
    ctx.beginPath();
    ctx.arc(cx, cy, R * want, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const { swarm, colours, locked } = sim;
  const frame = sim.frame;
  const ready = isReady(sim.watch);
  const size = Math.max(1.5, width / 150);
  for (let i = 0; i < swarm.n; i++) {
    const a = swarm.theta[i] - frame;
    const px = cx + R * Math.cos(a);
    const py = cy - R * Math.sin(a);
    const [cr, cg, cb] = colours[i];
    if (!ready || locked[i]) {
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.8)`;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    } else {
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.7)`;
      ctx.lineWidth = Math.max(1, size / 3);
      ctx.strokeRect(px - size / 2, py - size / 2, size, size);
    }
  }

  const a = psi - frame;
  const tx = cx + R * r * Math.cos(a);
  const ty = cy - R * r * Math.sin(a);
  ctx.strokeStyle = '#e2ff78';
  ctx.fillStyle = '#e2ff78';
  ctx.lineWidth = Math.max(2, width / 150);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx, ty, ctx.lineWidth * 1.6, 0, TAU);
  ctx.fill();
}

function axes(ctx, box, xTicks, yTicks, sx, sy, xLabel, yLabel, fmtX) {
  const font = Math.round(box.font);
  ctx.font = `${font}px system-ui, sans-serif`;
  ctx.strokeStyle = '#1d2a20';
  ctx.fillStyle = '#a3b39f';
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of yTicks) {
    const y = sy(v);
    ctx.beginPath();
    ctx.moveTo(box.left, y);
    ctx.lineTo(box.right, y);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), box.left - font * 0.4, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of xTicks) {
    const x = sx(v);
    ctx.beginPath();
    ctx.moveTo(x, box.top);
    ctx.lineTo(x, box.bottom);
    ctx.stroke();
    ctx.fillText(fmtX(v), x, box.bottom + font * 0.35);
  }
  ctx.fillText(xLabel, (box.left + box.right) / 2, box.bottom + font * 1.6);
  ctx.textBaseline = 'middle';
  ctx.font = `italic ${font * 1.15}px Georgia, serif`;
  ctx.fillText(yLabel, font * 0.8, (box.top + box.bottom) / 2);
}

function chartBox(canvas, dpr) {
  const { width, height } = canvas;
  const font = 12 * dpr;
  return { left: font * 3.2, right: width - font * 0.8, top: font * 0.8, bottom: height - font * 3, font };
}

function drawTrace() {
  const canvas = els.trace;
  const dpr = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const box = chartBox(canvas, dpr);
  const sx = linearScale(-TRACE_SECONDS, 0, box.left, box.right);
  const sy = linearScale(0, 1, box.bottom, box.top);
  axes(ctx, box, niceTicks(-TRACE_SECONDS, 0, 4), niceTicks(0, 1, 5), sx, sy, 'seconds ago', 'r', (v) => String(-v));

  const want = hasTheory() ? steadyOrder(params.distribution, params.spread, params.coupling) : null;
  if (want !== null) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#6f8a63';
    ctx.lineWidth = Math.max(1.5, canvas.width / 400);
    ctx.beginPath();
    ctx.moveTo(box.left, sy(want));
    ctx.lineTo(box.right, sy(want));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const values = traceValues(sim.trace);
  if (values.length > 1) {
    ctx.strokeStyle = '#e2ff78';
    ctx.lineWidth = Math.max(1.5, canvas.width / 300);
    ctx.beginPath();
    values.forEach((v, i) => {
      const t = -(values.length - 1 - i) * SAMPLE_EVERY;
      const x = sx(Math.max(t, -TRACE_SECONDS));
      if (i === 0) ctx.moveTo(x, sy(v));
      else ctx.lineTo(x, sy(v));
    });
    ctx.stroke();
  }
}

function drawSweep() {
  const canvas = els.sweep;
  const dpr = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const box = chartBox(canvas, dpr);
  const sx = linearScale(0, K_MAX, box.left, box.right);
  const sy = linearScale(0, 1, box.bottom, box.top);
  axes(ctx, box, niceTicks(0, K_MAX, 4), niceTicks(0, 1, 5), sx, sy, 'coupling K', 'r', (v) => String(v));

  const lw = Math.max(1.5, canvas.width / 300);
  const Kc = criticalCoupling(params.distribution, params.spread);
  if (hasTheory()) {
    ctx.strokeStyle = '#6f8a63';
    ctx.lineWidth = lw;
    ctx.beginPath();
    const steps = 240;
    for (let j = 0; j <= steps; j++) {
      const K = (K_MAX * j) / steps;
      const x = sx(K);
      const y = sy(steadyOrder(params.distribution, params.spread, K));
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (Kc < K_MAX) {
      ctx.fillStyle = '#6f8a63';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Kc', sx(Kc), sy(0) - box.font * 0.3);
    }
  }

  ctx.strokeStyle = 'rgba(214,242,122,0.35)';
  ctx.lineWidth = lw;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(sx(params.coupling), box.top);
  ctx.lineTo(sx(params.coupling), box.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  const points = sweepResult ? sweepResult.points : sweep ? sweep.results : [];
  ctx.fillStyle = '#ff9640';
  ctx.strokeStyle = '#ff9640';
  for (const p of points) {
    const x = sx(p.coupling);
    ctx.beginPath();
    ctx.moveTo(x, sy(Math.max(0, p.r - p.spread)));
    ctx.lineTo(x, sy(Math.min(1, p.r + p.spread)));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, sy(p.r), lw * 2, 0, TAU);
    ctx.fill();
  }
}

function updateStatus(r) {
  const parts = [`r = ${r.toFixed(2)}`];
  const global = hasTheory();
  if (global) parts[0] += ` (theory ${steadyOrder(params.distribution, params.spread, params.coupling).toFixed(2)})`;
  if (isReady(sim.watch)) {
    let text = `locked ${Math.round(lockedShare(sim.watch) * 100)}%`;
    if (global) text += ` (theory ${Math.round(lockedFraction(params.distribution, params.spread, params.coupling) * 100)}%)`;
    parts.push(text);
  } else {
    parts.push('locked: watching…');
  }
  parts.push(`t = ${Math.floor(sim.swarm.time)} s`);
  els.status.textContent = parts.join(' · ');
}

// ---------------------------------------------------------------- loop

// Simulated time owed to the swarm. Frames rarely last a whole number of
// steps, so the remainder carries over instead of being rounded away.
let owed = 0;

function advance(seconds) {
  owed = Math.min(owed + seconds, 4000 * DT);
  const steps = Math.floor(owed / DT + 1e-9);
  owed -= steps * DT;
  const stepSwarm = sim.swarm.kind === 'pulse' ? pulseStep : step;
  for (let s = 0; s < steps; s++) {
    stepSwarm(sim.swarm, DT);
    sim.frame = (sim.frame + DRIFT * DT) % TAU;
    sinceSample += DT;
    if (sinceSample >= SAMPLE_EVERY - 1e-9) {
      sinceSample -= SAMPLE_EVERY;
      sampleLockWatch(sim.watch, sim.swarm.theta);
      pushTrace(sim.trace, orderParameter(sim.swarm.theta).r);
    }
  }
}

function frame(now) {
  const elapsed = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  if (running) advance(elapsed * SPEEDS[Number(els.speed.value)]);
  if (sweep) runSweepSlice(8);
  if (isReady(sim.watch)) lockedMask(sim.watch, sim.locked);
  const { r, psi } = orderParameter(sim.swarm.theta);
  drawMeadow();
  drawCircle(r, psi);
  drawTrace();
  updateStatus(r);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', drawSweep);

build();
syncControls();
drawSweep();
requestAnimationFrame(frame);
