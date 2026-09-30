// Pulse coupling after Mirollo and Strogatz: closer to how real fireflies
// behave. Each firefly charges along a concave curve x = f(phi) as its phase
// phi runs from 0 to 1. At x = 1 it flashes and resets to 0, and every
// firefly that sees the flash is kicked up by strength / k (k = how many it
// sees). A kick that takes x past 1 fires that firefly too, in the same
// instant, and from then on the two are absorbed into one group.
//
// Phases are stored as theta = 2 pi phi so the order parameter, lock watch
// and drawing code work unchanged.

const TAU = 2 * Math.PI;

// Charging curve and its inverse. b > 0 makes f concave (a leaky charge);
// b -> 0 is the straight line f(phi) = phi.
export function charge(phi, b) {
  if (b < 1e-6) return phi;
  return Math.log1p(Math.expm1(b) * phi) / b;
}

export function uncharge(x, b) {
  if (b < 1e-6) return x;
  return Math.expm1(b * x) / Math.expm1(b);
}

export function createPulseSwarm({ omega, theta, drift = Math.PI, strength = 0.1, curvature = 3, neighbours = null } = {}) {
  const n = omega.length;
  return {
    kind: 'pulse',
    n,
    omega: Float64Array.from(omega),
    theta: theta ? Float64Array.from(theta, (t) => t - TAU * Math.floor(t / TAU)) : new Float64Array(n),
    drift,
    strength,
    curvature,
    neighbours,
    time: 0,
    fired: new Uint8Array(n),
    received: new Float64Array(n),
    wave: [],
    next: [],
  };
}

// Cycles per second. A firefly whose natural frequency would run backwards
// is slowed to a crawl instead; pulse coupling needs a forward clock.
function rate(swarm, i) {
  return Math.max(0.05 * swarm.drift, swarm.drift + swarm.omega[i]) / TAU;
}

// Advance by dt. Returns the number of flashes; `flashed` (optional)
// receives a 1 for each firefly that flashed during the step.
export function pulseStep(swarm, dt, flashed = null) {
  const { n, theta, fired, received, neighbours, strength, curvature: b } = swarm;
  let wave = swarm.wave;
  let next = swarm.next;
  wave.length = 0;
  fired.fill(0);

  for (let i = 0; i < n; i++) {
    const phi = theta[i] / TAU + rate(swarm, i) * dt;
    if (phi >= 1) {
      fired[i] = 1;
      theta[i] = 0;
      wave.push(i);
    } else {
      theta[i] = phi * TAU;
    }
  }

  // Deliver flashes in waves: everyone who fired in one wave kicks their
  // watchers at once, and anyone pushed over the top fires in the next.
  let total = wave.length;
  while (wave.length && strength > 0) {
    next.length = 0;
    if (!neighbours) {
      const kick = (strength * wave.length) / Math.max(1, n - 1);
      for (let i = 0; i < n; i++) if (!fired[i]) received[i] = kick;
    } else {
      const { start, index } = neighbours;
      for (const j of wave) {
        for (let e = start[j]; e < start[j + 1]; e++) {
          const i = index[e];
          if (!fired[i]) received[i] += strength / (start[i + 1] - start[i]);
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (fired[i] || received[i] === 0) continue;
      const x = charge(theta[i] / TAU, b) + received[i];
      received[i] = 0;
      if (x >= 1 - 1e-12) {
        fired[i] = 1;
        theta[i] = 0;
        next.push(i);
      } else {
        theta[i] = uncharge(x, b) * TAU;
      }
    }
    total += next.length;
    [wave, next] = [next, wave];
  }
  swarm.wave = wave;
  swarm.next = next;

  if (flashed) for (let i = 0; i < n; i++) if (fired[i]) flashed[i] = 1;
  swarm.time += dt;
  return total;
}
