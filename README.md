# lampyrid

Fireflies that learn to flash together. Each firefly is an oscillator with
its own natural rhythm; each one nudges its phase toward the flashes it sees.
Below a critical coupling strength the meadow twinkles at random. Above it, a
cluster of fireflies locks together and grows, and the whole field starts to
pulse as one. This is the Kuramoto model, and for some frequency spreads its
threshold and its steady state are known exactly, so the page can check the
simulation against the formula as you watch.

**Live demo:** https://fushanbobfan.github.io/lampyrid/

No build step and no dependencies. The model, the theory, the sweep, the
lock detector, the settings and the drawing helpers are plain ES modules
covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

**Cross the threshold.** Start from *Twilight* and drag the coupling slider
up slowly. Nothing much happens until *K* passes the threshold shown under
the slider; then a cluster forms on the phase circle, the arrow grows, and
the meadow starts to pulse. The dashed line on the trace is where the order
parameter *r* should settle for an infinite meadow; the status line compares
the live values of *r* and the locked share with their predictions.

**Run a sweep.** *Run sweep* steps *K* from 0 to 4 on a copy of the current
swarm, lets it settle at each value and averages *r*. With a Lorentzian
spread the points sit on Kuramoto's curve `r = sqrt(1 - Kc/K)`; below the
threshold a finite meadow still shows *r* of order `1/sqrt(N)` from chance
alone.

**Snap.** With a uniform spread there are no stragglers in the tails, and
the transition is abrupt: the predicted *r* jumps from 0 straight to π/4 at
the threshold. In the *Snap* preset the meadow dithers for a while and then
locks almost all at once.

**Waves in the grass.** With *Only nearby fireflies*, each one sees only
those within the sight radius. Patches lock on their own, and where they meet
the flashes roll across the meadow as travelling waves. Nearly every firefly
ends up keeping the same rhythm (the locked share is high) while *r* stays
low, because the phase varies across the meadow: frequency locking without
phase agreement.

**Startle them.** Click or drag on the meadow to scramble the phases of a
patch and watch the crowd pull it back into step.

## Controls

| Control | What it does |
| --- | --- |
| Preset | Five starting scenes; changing any setting afterwards shows *Custom* |
| Coupling *K* | How hard each firefly pulls toward the flashes it sees; changes live |
| Spread of rhythms | Lorentzian, Gaussian or uniform distribution of natural frequencies |
| Spread width | Lorentzian half-width γ, Gaussian σ or uniform half-width, in rad/s |
| Fireflies | 50 to 1500 |
| Rhythms drawn | Evenly by quantile (smooth, close to theory) or at random from the seed |
| Who sees whom | Everyone, or only fireflies within the sight radius |
| Seed | Positions, frequencies and starting phases; goes into share links |
| Speed | 0.25× to 16× simulated time |
| Colour fireflies by | Flash glow, or natural frequency (cool = slow, warm = fast) |
| Copy link / Save PNG | Settings in the address bar and clipboard; the meadow as an image |

Keys: <kbd>Space</kbd> pauses and resumes, <kbd>R</kbd> scatters every
phase, <kbd>S</kbd> runs a sweep.

## How it works

- `src/kuramoto.js` integrates
  `dθᵢ/dt = Ω + ωᵢ + (K/kᵢ) Σⱼ sin(θⱼ − θᵢ)` with classical fourth-order
  Runge–Kutta. With everyone in sight the sum collapses onto the order
  parameter `r e^{iψ}`, so a step costs O(N); with local sight, neighbour
  lists come from a bucket grid. Ω is a shared rhythm of one flash every two
  seconds and does not affect synchronization. Tests check the two-oscillator
  locking angle `asin(Δω/K)`, fourth-order convergence, and that local
  coupling with an unlimited radius reproduces the global form.
- `src/frequencies.js` draws natural frequencies by inverse CDF, either at
  evenly spaced quantiles (shuffled across the meadow) or at seeded random.
- `src/theory.js` solves the self-consistency equation
  `1 = K ∫ cos²t g(K r sin t) dt` for the steady *r*, with the threshold
  `Kc = 2/(π g(0))` and the closed form for the Lorentzian. Tests check the
  Gaussian's square-root onset against Strogatz's small-*r* expansion and the
  uniform spread's jump to π/4.
- `src/lockwatch.js` calls a firefly locked when its phase has slipped less
  than a quarter turn against the mean phase over the last eight seconds.
- `src/sweep.js` steps through couplings, carrying the phases from one value
  to the next, and averages *r* after a settling time.

## Limits

- The theory lines assume an infinite meadow with everyone in sight. With
  local sight the page shows no prediction, since there is no simple formula.
- Real fireflies are pulse-coupled: they react to discrete flashes rather
  than to a smooth sine of the phase difference. The Kuramoto model is the
  standard idealization of that, not a model of any particular species.
- The locked share uses a fixed slip tolerance, so fireflies drifting very
  slowly near the edge of the locking band can be counted as locked.

## References

- Y. Kuramoto, *Chemical Oscillations, Waves, and Turbulence*, Springer
  (1984).
- S. H. Strogatz, "From Kuramoto to Crawford: exploring the onset of
  synchronization in populations of coupled oscillators", *Physica D* 143
  (2000).

## License

MIT
