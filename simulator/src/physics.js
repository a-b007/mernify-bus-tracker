/**
 * physics.js — Speed and movement model for Bengaluru bus simulator.
 *
 * Exports:
 *   computeSpeed(busType, hour, noise) → km/h
 *   applyRedLight(bus)                 → mutates bus.redLightTimer
 */

// Base speeds by bus type (km/h)
const BASE_SPEED = {
  NON_AC: 25,
  AC: 28,
  EV: 30,
};

// Time-of-day congestion multiplier (index = hour bracket)
const CONGESTION_BANDS = [
  { start: 0, end: 6, factor: 1.3 },
  { start: 6, end: 8, factor: 0.8 },
  { start: 8, end: 11, factor: 0.5 },
  { start: 11, end: 16, factor: 0.9 },
  { start: 16, end: 17, factor: 0.7 },
  { start: 17, end: 21, factor: 0.5 },
  { start: 21, end: 24, factor: 1.1 },
];

/**
 * Return the congestion factor for a given hour (0-23).
 */
export function getCongestionFactor(hour) {
  for (const band of CONGESTION_BANDS) {
    if (hour >= band.start && hour < band.end) return band.factor;
  }
  return 1.0; // fallback
}

/**
 * Box-Muller transform — returns a single standard-normal variate.
 */
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Compute the current speed of a bus (km/h).
 *
 * @param {string}  busType  — NON_AC | AC | EV
 * @param {number}  hour     — 0-23 (sim-time hour)
 * @param {boolean} noise    — whether to apply Gaussian noise (default true)
 * @returns {number} speed in km/h (clamped ≥ 0)
 */
export function computeSpeed(busType, hour, noise = true) {
  const base = BASE_SPEED[busType] ?? BASE_SPEED.NON_AC;
  const factor = getCongestionFactor(hour);
  let speed = base * factor;
  if (noise) {
    const sigma = 3; // km/h
    speed += gaussianRandom() * sigma;
  }
  return Math.max(0, speed);
}

/**
 * Possibly apply a red-light stop to the bus.
 *
 * Called once per ~500 m segment advance.
 * 20 % chance of a red light; duration 10-60 s.
 *
 * Mutates `bus.redLightTimer` (seconds remaining).
 * Returns true if a red light was triggered.
 */
export function applyRedLight(bus) {
  if (bus.redLightTimer > 0) return false; // already waiting
  if (Math.random() < 0.2) {
    bus.redLightTimer = 10 + Math.random() * 50; // 10-60 s
    return true;
  }
  return false;
}
