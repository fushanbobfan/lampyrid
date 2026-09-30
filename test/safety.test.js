import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frequencyColour, glowColour } from '../src/meadow.js';
import {
  flashRate, FLASH_LIMIT_HZ, gentleLevel, gentleOpacity, isGentle, MAX_LUMINANCE_SWING, relativeLuminance,
} from '../src/safety.js';

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];
const DRIFT = Math.PI;

test('relative luminance matches the WCAG reference points', () => {
  assert.equal(relativeLuminance([0, 0, 0]), 0);
  assert.ok(Math.abs(relativeLuminance([255, 255, 255]) - 1) < 1e-12);
  assert.ok(Math.abs(relativeLuminance([128, 128, 128]) - 0.2158605) < 1e-6);
});

test('full glow swings far past the limit, which is why gentle mode exists', () => {
  const swing = relativeLuminance(glowColour(1)) - relativeLuminance(glowColour(0));
  assert.ok(swing > 0.5);
});

test('gentle glow keeps the swing under the limit with a margin', () => {
  const swing = relativeLuminance(glowColour(gentleLevel(1))) - relativeLuminance(glowColour(gentleLevel(0)));
  assert.ok(swing > 0.02, 'still visible');
  assert.ok(swing < 0.8 * MAX_LUMINANCE_SWING, `swing ${swing}`);
});

test('gentle frequency colours keep every rhythm under the limit', () => {
  for (let w = -3; w <= 3; w += 0.05) {
    const c = frequencyColour(w, 0.5);
    const at = (a) => relativeLuminance(c.map((v) => v * a));
    const swing = at(gentleOpacity(1)) - at(gentleOpacity(0));
    assert.ok(swing < 0.8 * MAX_LUMINANCE_SWING, `w=${w} swing ${swing}`);
  }
});

test('auto mode goes gentle exactly at the speeds that would flash too fast', () => {
  const gentle = SPEEDS.filter((s) => isGentle('auto', flashRate(DRIFT, s)));
  assert.deepEqual(gentle, [8, 16]);
  assert.equal(flashRate(DRIFT, 4), 2);
  assert.ok(flashRate(DRIFT, 8) > FLASH_LIMIT_HZ);
  assert.ok(SPEEDS.every((s) => isGentle('always', flashRate(DRIFT, s))));
});
