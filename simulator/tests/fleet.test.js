import { describe, it, expect } from "vitest";
import { createBus, tickBus } from "../src/fleet.js";

const sampleRoute = {
  routeId: "335E-UP",
  geometry: {
    type: "LineString",
    coordinates: [
      [77.5946, 12.9716],
      [77.6088, 12.9766],
      [77.6205, 12.9852],
      [77.6350, 12.9780],
    ],
  },
  stops: [
    { stopId: "S1", name: "Stop 1", distanceM: 500 },
    { stopId: "S2", name: "Stop 2", distanceM: 1500 },
  ],
};

const reverseRoute = {
  routeId: "335E-DN",
  geometry: {
    type: "LineString",
    coordinates: [
      [77.6350, 12.9780],
      [77.6205, 12.9852],
      [77.6088, 12.9766],
      [77.5946, 12.9716],
    ],
  },
  stops: [
    { stopId: "S2", name: "Stop 2", distanceM: 500 },
    { stopId: "S1", name: "Stop 1", distanceM: 1500 },
  ],
};

describe("fleet state machine", () => {
  it("initializes bus with valid fields and position", () => {
    const bus = createBus("B0001", "KA-57-F-0001", "NON_AC", sampleRoute, "335E-UP", 100);
    expect(bus.busId).toBe("B0001");
    expect(bus.seq).toBe(0);
    expect(bus.state).toBe("RUNNING");
    expect(bus.progressM).toBe(100);
    expect(bus.curPos).toBeDefined();
    expect(bus.curPos.length).toBe(2);
  });

  it("increments seq monotonically and returns telemetry event on tick", () => {
    const bus = createBus("B0001", "KA-57-F-0001", "NON_AC", sampleRoute, "335E-UP", 100);
    const ev1 = tickBus(bus, 1, 10);
    expect(bus.seq).toBe(1);
    expect(ev1.seq).toBe(1);
    expect(ev1.busId).toBe("B0001");
    expect(typeof ev1.lat).toBe("number");
    expect(typeof ev1.lng).toBe("number");
    expect(typeof ev1.speed).toBe("number");
    expect(typeof ev1.heading).toBe("number");

    const ev2 = tickBus(bus, 1, 10);
    expect(bus.seq).toBe(2);
    expect(ev2.seq).toBe(2);
    expect(ev2.seq).toBeGreaterThan(ev1.seq);
  });

  it("transitions to DWELLING when crossing a stop and exchanges passengers", () => {
    const bus = createBus("B0001", "KA-57-F-0001", "NON_AC", sampleRoute, "335E-UP", 495);
    bus.occ = 20;
    // Tick with sufficient dt to cross 500m
    tickBus(bus, 2, 3); // 2s at ~30km/h is ~16m advance -> reaches 500m
    expect(bus.state).toBe("DWELLING");
    expect(bus.dwellTimer).toBeGreaterThan(0);
    expect(bus.speed).toBe(0);

    // Ticking while dwelling decrements timer and keeps speed 0
    const prevTimer = bus.dwellTimer;
    tickBus(bus, 5, 3);
    expect(bus.dwellTimer).toBeCloseTo(prevTimer - 5, 2);
    expect(bus.speed).toBe(0);
  });

  it("transitions to RESTING at route terminus and swaps direction after rest", () => {
    const bus = createBus("B0001", "KA-57-F-0001", "NON_AC", sampleRoute, "335E-UP", 50000);
    bus.reverseRoute = reverseRoute;

    tickBus(bus, 1, 10);
    expect(bus.state).toBe("RESTING");
    expect(bus.restTimer).toBeGreaterThan(0);

    // Fast-forward rest timer
    bus.restTimer = 1;
    tickBus(bus, 2, 10);
    expect(bus.state).toBe("RUNNING");
    expect(bus.progressM).toBe(0);
    expect(bus.direction).toBe("DN");
    expect(bus.routeId).toBe("335E-DN");
  });

  it("handles BROKEN_DOWN state correctly", () => {
    const bus = createBus("B0001", "KA-57-F-0001", "NON_AC", sampleRoute, "335E-UP", 100);
    bus.state = "BROKEN_DOWN";
    bus.breakdownTimer = 10;

    tickBus(bus, 4, 10);
    expect(bus.state).toBe("BROKEN_DOWN");
    expect(bus.breakdownTimer).toBe(6);
    expect(bus.speed).toBe(0);

    tickBus(bus, 7, 10);
    expect(bus.state).toBe("RUNNING");
    expect(bus.breakdownTimer).toBe(0);
  });
});
