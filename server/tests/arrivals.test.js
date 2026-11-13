import { describe, it, expect, beforeEach } from 'vitest';
import { ArrivalDetector } from '../src/services/arrivals.js';

describe('ArrivalDetector', () => {
  let detector;
  let sampleRoute;

  beforeEach(() => {
    detector = new ArrivalDetector({
      proximityM: 40,
      defaultPlannedHeadwayS: 600, // 10 min
    });

    sampleRoute = {
      _id: 'R335E-UP',
      routeNo: '335E',
      stops: [
        { stopId: 'S001', offsetM: 0, seqNo: 1 },
        { stopId: 'S002', offsetM: 1000, seqNo: 2 },
        { stopId: 'S003', offsetM: 2500, seqNo: 3 },
      ],
    };
  });

  it('detects arrival when bus crosses stop offset', () => {
    const bus = {
      busId: 'B001',
      routeId: 'R335E-UP',
      tripId: 'T1',
      ts: new Date('2026-11-13T10:00:00Z'),
    };

    // Bus advances from 950m to 1050m (crossing S002 at 1000m)
    const arrival = detector.checkArrival(bus, 950, 1050, sampleRoute);

    expect(arrival).not.toBeNull();
    expect(arrival.busId).toBe('B001');
    expect(arrival.routeId).toBe('R335E-UP');
    expect(arrival.stopId).toBe('S002');
    expect(arrival.tripId).toBe('T1');
  });

  it('detects arrival when bus is within 40m proximity threshold', () => {
    const bus = {
      busId: 'B002',
      routeId: 'R335E-UP',
      tripId: 'T1',
      ts: new Date('2026-11-13T10:05:00Z'),
    };

    // Bus moved from 930m to 975m (within 25m of S002 at 1000m, <= 40m)
    const arrival = detector.checkArrival(bus, 930, 975, sampleRoute);

    expect(arrival).not.toBeNull();
    expect(arrival.stopId).toBe('S002');
  });

  it('prevents duplicate arrivals for the same bus, trip, and stop', () => {
    const bus = {
      busId: 'B003',
      routeId: 'R335E-UP',
      tripId: 'T1',
      ts: new Date('2026-11-13T10:10:00Z'),
    };

    // First detection: bus arrives at stop S002
    const first = detector.checkArrival(bus, 980, 1005, sampleRoute);
    expect(first).not.toBeNull();

    // Subsequent tick: bus is dwelling at stop (1005m -> 1010m)
    const second = detector.checkArrival(bus, 1005, 1010, sampleRoute);
    expect(second).toBeNull();
  });

  it('allows new arrival detection when tripId changes', () => {
    const busTrip1 = {
      busId: 'B004',
      routeId: 'R335E-UP',
      tripId: 'TRIP-1',
      ts: new Date('2026-11-13T08:00:00Z'),
    };
    const arrival1 = detector.checkArrival(busTrip1, 980, 1010, sampleRoute);
    expect(arrival1).not.toBeNull();

    // Next round trip with new tripId
    const busTrip2 = {
      busId: 'B004',
      routeId: 'R335E-UP',
      tripId: 'TRIP-2',
      ts: new Date('2026-11-13T10:00:00Z'),
    };
    const arrival2 = detector.checkArrival(busTrip2, 980, 1010, sampleRoute);
    expect(arrival2).not.toBeNull();
  });

  it('calculates headway and delay against planned headway', () => {
    // First bus arrives at 10:00:00
    const bus1 = {
      busId: 'B10',
      routeId: 'R335E-UP',
      tripId: 'T1',
      ts: new Date('2026-11-13T10:00:00Z'),
    };
    const a1 = detector.checkArrival(bus1, 980, 1010, sampleRoute);
    expect(a1.headwayS).toBeNull();
    expect(a1.delayS).toBe(0);

    // Second bus arrives 650 seconds later (10 min 50 sec)
    // Planned headway is 600 seconds, so delay is +50s
    const bus2 = {
      busId: 'B20',
      routeId: 'R335E-UP',
      tripId: 'T2',
      ts: new Date('2026-11-13T10:10:50Z'),
    };
    const a2 = detector.checkArrival(bus2, 980, 1010, sampleRoute);
    expect(a2.headwayS).toBe(650);
    expect(a2.delayS).toBe(50);
  });

  it('buffers arrivals and flushes properly', () => {
    expect(detector.bufferSize).toBe(0);

    const bus1 = { busId: 'B1', routeId: 'R335E-UP', tripId: 'T1', ts: new Date() };
    detector.checkArrival(bus1, 980, 1010, sampleRoute);

    const bus2 = { busId: 'B2', routeId: 'R335E-UP', tripId: 'T2', ts: new Date() };
    detector.checkArrival(bus2, 2480, 2510, sampleRoute);

    expect(detector.bufferSize).toBe(2);

    const flushed = detector.flushArrivals();
    expect(flushed.length).toBe(2);
    expect(detector.bufferSize).toBe(0);

    const secondFlush = detector.flushArrivals();
    expect(secondFlush.length).toBe(0);
  });
});
