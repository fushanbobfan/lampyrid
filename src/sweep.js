// A coupling sweep: step K through a list, let the swarm settle at each
// value, then average r over a measuring window. Phases carry over from one
// K to the next, as when a real experiment turns a knob slowly, so a sweep
// down can differ from a sweep up where the transition is abrupt.
//
// The sweep is advanced a budget of integration steps at a time so the
// page can run it between animation frames.

import { mulberry32 } from './frequencies.js';
import { createSwarm, orderParameter, randomPhases, step } from './kuramoto.js';

export function couplingLadder(from, to, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(count === 1 ? from : from + ((to - from) * i) / (count - 1));
  return out;
}

export function createSweep({ omega, couplings, seed = 1, dt = 0.05, settle = 30, measure = 30, neighbours = null }) {
  const swarm = createSwarm({ omega, theta: randomPhases(omega.length, mulberry32(seed)), coupling: couplings[0], neighbours });
  return {
    swarm,
    couplings,
    dt,
    settleSteps: Math.round(settle / dt),
    measureSteps: Math.round(measure / dt),
    index: 0,
    tick: 0,
    sum: 0,
    sumSq: 0,
    results: [],
    done: couplings.length === 0,
  };
}

export function advanceSweep(sweep, budget) {
  const { swarm, dt, settleSteps, measureSteps } = sweep;
  let used = 0;
  while (!sweep.done && used < budget) {
    step(swarm, dt);
    used++;
    sweep.tick++;
    if (sweep.tick > settleSteps) {
      const { r } = orderParameter(swarm.theta);
      sweep.sum += r;
      sweep.sumSq += r * r;
    }
    if (sweep.tick === settleSteps + measureSteps) {
      const mean = sweep.sum / measureSteps;
      const variance = Math.max(0, sweep.sumSq / measureSteps - mean * mean);
      sweep.results.push({ coupling: sweep.couplings[sweep.index], r: mean, spread: Math.sqrt(variance) });
      sweep.index++;
      sweep.tick = 0;
      sweep.sum = 0;
      sweep.sumSq = 0;
      if (sweep.index >= sweep.couplings.length) sweep.done = true;
      else swarm.coupling = sweep.couplings[sweep.index];
    }
  }
  return used;
}

export function sweepProgress(sweep) {
  const perPoint = sweep.settleSteps + sweep.measureSteps;
  const total = perPoint * sweep.couplings.length;
  return total === 0 ? 1 : (sweep.index * perPoint + sweep.tick) / total;
}
