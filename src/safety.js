// Flash safety. A synchronized meadow lights up most of the screen at once,
// and at high simulation speeds it would do so several times a second.
// WCAG 2.3.1 treats anything flashing more than three times a second as a
// seizure risk unless the change in relative luminance stays under 10%.
// Gentle mode keeps every firefly's swing well under that line, and the page
// switches to it automatically whenever the flash rate would pass the limit.

export const FLASH_LIMIT_HZ = 3;
export const MAX_LUMINANCE_SWING = 0.1;

// Gentle ranges, checked against MAX_LUMINANCE_SWING by the tests with a
// margin: glow level for the default colouring, and dot opacity for the
// frequency colouring.
export const GENTLE_GLOW = [0, 0.22];
export const GENTLE_OPACITY = [0.25, 0.4];

export function flashRate(drift, speed) {
  return (speed * drift) / (2 * Math.PI);
}

// preference: 'auto' goes gentle only above the flash limit; 'always' stays gentle.
export function isGentle(preference, rate) {
  return preference === 'always' || rate > FLASH_LIMIT_HZ;
}

export function gentleLevel(level) {
  const [lo, hi] = GENTLE_GLOW;
  return lo + (hi - lo) * level;
}

export function gentleOpacity(level) {
  const [lo, hi] = GENTLE_OPACITY;
  return lo + (hi - lo) * level;
}

// WCAG relative luminance of an sRGB colour given as 0..255 channels.
export function relativeLuminance([r, g, b]) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
