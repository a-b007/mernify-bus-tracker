import { describe, it, expect } from "vitest";
import { computeSpeed, getCongestionFactor, applyRedLight } from "../src/physics.js";

describe("physics", () => {
  it("computes congestion factor correctly for different hours", () => {
    expect(getCongestionFactor(3)).toBe(1.3);
    expect(getCongestionFactor(7)).toBe(0.8);
    expect(getCongestionFactor(9)).toBe(0.5);
    expect(getCongestionFactor(12)).toBe(0.9);
    expect(getCongestionFactor(16)).toBe(0.7);
    expect(getCongestionFactor(19)).toBe(0.5);
    expect(getCongestionFactor(22)).toBe(1.1);
  });

  it("computes base speed scaled by congestion without noise", () => {
    // NON_AC base = 25
    expect(computeSpeed("NON_AC", 9, false)).toBeCloseTo(25 * 0.5, 2);
    // AC base = 28
    expect(computeSpeed("AC", 3, false)).toBeCloseTo(28 * 1.3, 2);
    // EV base = 30
    expect(computeSpeed("EV", 12, false)).toBeCloseTo(30 * 0.9, 2);
  });

  it("computes speed with noise and keeps it non-negative", () => {
    for (let i = 0; i < 50; i++) {
      const speed = computeSpeed("NON_AC", 9, true);
      expect(speed).toBeGreaterThanOrEqual(0);
    }
  });

  it("applies red light conditionally", () => {
    const bus = { redLightTimer: 0 };
    let triggered = false;
    for (let i = 0; i < 100; i++) {
      bus.redLightTimer = 0;
      if (applyRedLight(bus)) {
        triggered = true;
        expect(bus.redLightTimer).toBeGreaterThanOrEqual(10);
        expect(bus.redLightTimer).toBeLessThanOrEqual(60);
      }
    }
    expect(triggered).toBe(true);

    // If already waiting, does not trigger again
    bus.redLightTimer = 30;
    expect(applyRedLight(bus)).toBe(false);
    expect(bus.redLightTimer).toBe(30);
  });
});
