import { describe, it, expect, beforeEach } from 'vitest';
import {
  setStaticData,
  processBatch,
  processEvent,
  getBusState,
  getDeltaPayload,
  getState,
} from '../src/services/processor.js';

describe('Processor Service', () => {
  const mockStops = [
    {
      _id: 'S0001',
      name: 'Stop 1',
      loc: { type: 'Point', coordinates: [77.5700, 12.9700] },
      routeIds: ['R1-UP'],
    },
    {
      _id: 'S0002',
      name: 'Stop 2',
      loc: { type: 'Point', coordinates: [77.5800, 12.9700] },
      routeIds: ['R1-UP'],
    },
  ];

  const mockRoutes = [
    {
      _id: 'R1-UP',
      routeNo: 'R1',
      direction: 'UP',
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5700, 12.9700],
          [77.5800, 12.9700],
          [77.5900, 12.9700],
        ],
      },
      stops: [
        { stopId: 'S0001', offsetM: 0, seqNo: 1 },
        { stopId: 'S0002', offsetM: 1080, seqNo: 2 },
      ],
    },
  ];

  const mockBuses = [
    {
      _id: 'B0001',
      regNo: 'KA-57-F-1111',
      routeId: 'R1-UP',
      type: 'AC',
    },
  ];

  beforeEach(() => {
    setStaticData({
      stops: mockStops,
      routes: mockRoutes,
      buses: mockBuses,
    });
  });

  it('successfully processes valid telemetry and calculates EMA speed', () => {
    const t0 = 1731500000000;
    const res = processEvent({
      busId: 'B0001',
      seq: 1,
      ts: t0,
      lat: 12.9700,
      lng: 77.5700,
      speed: 30,
      heading: 90,
      occ: 20,
    });

    expect(res.success).toBe(true);
    const state = getBusState('B0001');
    expect(state).toBeDefined();
    expect(state.progressM).toBeCloseTo(0, -1);
    expect(state.emaSpeed).toBe(30);
    expect(state.nextStopId).toBe('S0002');
  });

  it('rejects stale sequence numbers (seq <= lastSeq)', () => {
    const t0 = 1731500000000;
    processEvent({
      busId: 'B0001',
      seq: 10,
      ts: t0,
      lat: 12.9700,
      lng: 77.5700,
      speed: 30,
      heading: 90,
    });

    // Replay same seq
    const resSame = processEvent({
      busId: 'B0001',
      seq: 10,
      ts: t0 + 1000,
      lat: 12.9700,
      lng: 77.5705,
      speed: 30,
      heading: 90,
    });
    expect(resSame.success).toBe(false);
    expect(resSame.reason).toMatch(/Stale sequence/);

    // Older seq
    const resOlder = processEvent({
      busId: 'B0001',
      seq: 9,
      ts: t0 + 2000,
      lat: 12.9700,
      lng: 77.5705,
      speed: 30,
      heading: 90,
    });
    expect(resOlder.success).toBe(false);
  });

  it('rejects impossible backward jumps (> 50m)', () => {
    const t0 = 1731500000000;
    // Set position further down line
    processEvent({
      busId: 'B0001',
      seq: 20,
      ts: t0,
      lat: 12.9700,
      lng: 77.5800, // at ~1080m
      speed: 30,
      heading: 90,
    });

    // Jump backwards to start
    const resJumpBack = processEvent({
      busId: 'B0001',
      seq: 21,
      ts: t0 + 1000,
      lat: 12.9700,
      lng: 77.5700, // at 0m, -1080m jump
      speed: 30,
      heading: 90,
    });

    expect(resJumpBack.success).toBe(false);
    expect(resJumpBack.reason).toMatch(/Impossible backward jump/);
  });

  it('detects arrivals when crossing or approaching stop offset', () => {
    const t0 = 1731500000000;
    processEvent({
      busId: 'B0001',
      seq: 30,
      ts: t0,
      lat: 12.9700,
      lng: 77.5790,
      speed: 25,
      heading: 90,
    });

    // Move directly onto Stop 2 (offset 1080m)
    const resArrival = processEvent({
      busId: 'B0001',
      seq: 31,
      ts: t0 + 2000,
      lat: 12.9700,
      lng: 77.5800,
      speed: 25,
      heading: 90,
    });

    expect(resArrival.success).toBe(true);
    expect(resArrival.arrival).toBeDefined();
    expect(resArrival.arrival?.stopId).toBe('S0002');
  });

  it('generates delta payload and resets dirty state', () => {
    const t0 = 1731500000000;
    processBatch([
      {
        busId: 'B0001',
        seq: 50,
        ts: t0,
        lat: 12.9700,
        lng: 77.5700,
        speed: 20,
        heading: 90,
      },
    ]);

    const delta1 = getDeltaPayload();
    expect(delta1).not.toBeNull();
    expect(delta1.rows.length).toBe(1);
    expect(delta1.rows[0][1]).toBe(1297000); // 12.97 * 1e5
    expect(delta1.rows[0][2]).toBe(7757000); // 77.57 * 1e5

    // Second call without new updates returns null
    const delta2 = getDeltaPayload();
    expect(delta2).toBeNull();
  });
});
