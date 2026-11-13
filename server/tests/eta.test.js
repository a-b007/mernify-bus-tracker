import { describe, it, expect, beforeEach } from 'vitest';
import { ETAService } from '../src/services/eta.js';

describe('ETAService', () => {
  let sampleRoute;
  let sampleBuses;
  let etaService;

  beforeEach(() => {
    // Route with 4 stops: S1 at 0m, S2 at 1000m, S3 at 3000m, S4 at 6000m
    sampleRoute = {
      _id: 'R101-UP',
      routeNo: '101',
      direction: 'UP',
      stops: [
        { stopId: 'S1', offsetM: 0, seqNo: 1 },
        { stopId: 'S2', offsetM: 1000, seqNo: 2 },
        { stopId: 'S3', offsetM: 3000, seqNo: 3 },
        { stopId: 'S4', offsetM: 6000, seqNo: 4 },
      ],
      defaultSpeed: 30, // 30 km/h
    };

    sampleBuses = new Map();
    etaService = new ETAService({
      routes: [sampleRoute],
      busState: sampleBuses,
      hourlyStats: [],
    });
  });

  it('returns empty array when no buses are running or stop is unknown', () => {
    expect(etaService.computeETAs('UNKNOWN')).toEqual([]);
    expect(etaService.computeETAs('S3')).toEqual([]);
  });

  it('computes ETA for an approaching bus correctly', () => {
    const now = Date.now();
    // Bus B1 at 1000m approaching S3 (offset 3000m, remaining 2000m)
    // 0 intermediate stops (S2 is at 1000m which is <= progressM)
    // Bus speed: 30 km/h = 8.333 m/s. Remaining 2000m / 8.333 = 240s
    sampleBuses.set('B1', {
      _id: 'B1',
      routeId: 'R101-UP',
      progressM: 1000,
      emaSpeed: 30,
      ts: now - 2000, // 2s ago (fresh < 10s)
    });

    etaService.setBusState(sampleBuses);
    const etas = etaService.computeETAs('S3', now);

    expect(etas.length).toBe(1);
    expect(etas[0].busId).toBe('B1');
    expect(etas[0].routeNo).toBe('101');
    expect(etas[0].etaS).toBe(240);
    expect(etas[0].confidence).toBe('high'); // <10s fresh and <3km
  });

  it('labels bus as "Arriving" if etaS < 60 seconds', () => {
    const now = Date.now();
    // Bus at 2850m approaching S3 (offset 3000m, remaining 150m)
    // At 30 km/h (8.33 m/s), 150m takes ~18s
    sampleBuses.set('B2', {
      _id: 'B2',
      routeId: 'R101-UP',
      progressM: 2850,
      emaSpeed: 30,
      ts: now - 1000,
    });

    etaService.setBusState(sampleBuses);
    const etas = etaService.computeETAs('S3', now);

    expect(etas.length).toBe(1);
    expect(etas[0].etaS).toBeLessThan(60);
    expect(etas[0].label).toBe('Arriving');
  });

  it('ignores buses that have already passed the stop (remaining < -30m)', () => {
    const now = Date.now();
    // Bus at 3050m (passed S3 at 3000m, remaining = -50m)
    sampleBuses.set('B3', {
      _id: 'B3',
      routeId: 'R101-UP',
      progressM: 3050,
      emaSpeed: 30,
      ts: now,
    });

    etaService.setBusState(sampleBuses);
    const etas = etaService.computeETAs('S3', now);
    expect(etas).toEqual([]);
  });

  it('excludes stale buses (lastSeen >= 30s ago)', () => {
    const now = Date.now();
    sampleBuses.set('B_STALE', {
      _id: 'B_STALE',
      routeId: 'R101-UP',
      progressM: 500,
      emaSpeed: 30,
      ts: now - 35000, // 35 seconds ago
    });

    etaService.setBusState(sampleBuses);
    const etas = etaService.computeETAs('S3', now);
    expect(etas).toEqual([]);
  });

  it('includes dwell time for intermediate stops between bus and target stop', () => {
    const now = Date.now();
    // Target stop is S4 (offset 6000m). Bus is at progressM 500m.
    // Stops between 500m and 6000m are S2 (1000m) and S3 (3000m) => 2 stops.
    // Dwell time fallback is 25s per stop => 50s dwell.
    // Speed: 30 km/h (8.333 m/s). Remaining: 5500m => 660s travel.
    // Total ETA = 660 + 50 = 710s.
    sampleBuses.set('B4', {
      _id: 'B4',
      routeId: 'R101-UP',
      progressM: 500,
      emaSpeed: 30,
      ts: now - 1000,
    });

    etaService.setBusState(sampleBuses);
    const etas = etaService.computeETAs('S4', now);

    expect(etas.length).toBe(1);
    expect(etas[0].etaS).toBe(710);
  });

  it('enforces minimum speed floor of 8 km/h', () => {
    const now = Date.now();
    // Bus moving extremely slowly (e.g. 1 km/h) or stuck
    sampleBuses.set('B_SLOW', {
      _id: 'B_SLOW',
      routeId: 'R101-UP',
      progressM: 2500,
      emaSpeed: 1, // blended with default fallback 25 => 13 km/h
      ts: now - 1000,
    });

    // Custom route with 0 fallback speed to test floor
    const slowRoute = {
      _id: 'SLOW-R',
      routeNo: 'SLOW',
      stops: [{ stopId: 'S_TARGET', offsetM: 1000 }],
      defaultSpeed: 2,
    };
    const testService = new ETAService({
      routes: [slowRoute],
      busState: new Map([
        ['B_ZERO', { _id: 'B_ZERO', routeId: 'SLOW-R', progressM: 200, emaSpeed: 1, ts: now }],
      ]),
    });

    const etas = testService.computeETAs('S_TARGET', now);
    expect(etas.length).toBe(1);
    // 800m at min speed 8 km/h (2.222 m/s) => 360 seconds
    expect(etas[0].etaS).toBe(360);
  });

  it('returns top 3 nearest buses sorted by etaS ascending', () => {
    const now = Date.now();
    sampleBuses.set('B_FAR', { _id: 'B_FAR', routeId: 'R101-UP', progressM: 200, emaSpeed: 30, ts: now - 1000 });
    sampleBuses.set('B_CLOSE', { _id: 'B_CLOSE', routeId: 'R101-UP', progressM: 2700, emaSpeed: 30, ts: now - 1000 });
    sampleBuses.set('B_MID', { _id: 'B_MID', routeId: 'R101-UP', progressM: 1500, emaSpeed: 30, ts: now - 1000 });
    sampleBuses.set('B_VERY_FAR', { _id: 'B_VERY_FAR', routeId: 'R101-UP', progressM: 50, emaSpeed: 30, ts: now - 1000 });

    etaService.setBusState(sampleBuses);
    const etas = etaService.computeETAs('S3', now);

    expect(etas.length).toBe(3);
    expect(etas[0].busId).toBe('B_CLOSE');
    expect(etas[1].busId).toBe('B_MID');
    expect(etas[2].busId).toBe('B_FAR');
    expect(etas[0].etaS).toBeLessThan(etas[1].etaS);
    expect(etas[1].etaS).toBeLessThan(etas[2].etaS);
  });

  it('manages socket subscriber counts properly', () => {
    expect(etaService.getSubscribedStops().size).toBe(0);

    etaService.setSubscribers('S1', 2);
    etaService.setSubscribers('S2', 1);
    expect(etaService.getSubscribedStops().has('S1')).toBe(true);
    expect(etaService.getSubscribedStops().has('S2')).toBe(true);
    expect(etaService.getSubscribedStops().size).toBe(2);

    etaService.setSubscribers('S1', 0);
    expect(etaService.getSubscribedStops().has('S1')).toBe(false);
    expect(etaService.getSubscribedStops().size).toBe(1);
  });
});
