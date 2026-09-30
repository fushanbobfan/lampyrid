import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrace, linearScale, niceTicks, pushTrace, traceValues } from '../src/chart.js';
import { frequencyColour, glow, glowColour, placeFireflies } from '../src/meadow.js';

test('fireflies are placed inside the unit square, one per jittered cell, reproducibly', () => {
  const a = placeFireflies(500, 3);
  const b = placeFireflies(500, 3);
  assert.deepEqual(a, b);
  const cols = Math.ceil(Math.sqrt(500));
  const rows = Math.ceil(500 / cols);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    assert.ok(a.x[i] > 0 && a.x[i] < 1 && a.y[i] > 0 && a.y[i] < 1);
    const key = `${Math.floor(a.x[i] * cols)},${Math.floor(a.y[i] * rows)}`;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
  assert.notDeepEqual(placeFireflies(500, 4), a);
});

test('glow peaks at the flash and fades through the cycle', () => {
  assert.equal(glow(0), 1);
  assert.equal(glow(2 * Math.PI), 1);
  assert.ok(glow(0.2) > glow(1) && glow(1) > glow(3));
  assert.ok(glow(-0.01) < 0.001);
});

test('colours stay in byte range and run cool to warm', () => {
  for (const w of [-5, -0.5, 0, 0.5, 5]) {
    for (const c of frequencyColour(w, 0.5)) assert.ok(Number.isInteger(c) && c >= 0 && c <= 255);
  }
  const slow = frequencyColour(-2, 0.5);
  const fast = frequencyColour(2, 0.5);
  assert.ok(slow[2] > slow[0] && fast[0] > fast[2]);
  assert.deepEqual(glowColour(2), glowColour(1));
  assert.ok(glowColour(1)[1] > glowColour(0)[1]);
});

test('linear scale maps ends and handles a flat domain', () => {
  const s = linearScale(0, 4, 10, 110);
  assert.equal(s(0), 10);
  assert.equal(s(4), 110);
  assert.equal(s(1), 35);
  assert.equal(linearScale(1, 1, 5, 9)(3), 5);
});

test('nice ticks land on round numbers covering the range', () => {
  assert.deepEqual(niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(0, 4, 4), [0, 1, 2, 3, 4]);
  assert.deepEqual(niceTicks(0.3, 1.7, 3), [0.5, 1, 1.5]);
  assert.deepEqual(niceTicks(2, 2), [2]);
});

test('trace keeps the newest values in order', () => {
  const t = createTrace(3);
  pushTrace(t, 1);
  pushTrace(t, 2);
  assert.deepEqual(traceValues(t), [1, 2]);
  pushTrace(t, 3);
  pushTrace(t, 4);
  pushTrace(t, 5);
  assert.deepEqual(traceValues(t), [3, 4, 5]);
});
