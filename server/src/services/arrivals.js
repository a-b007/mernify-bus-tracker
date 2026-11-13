/**
 * ArrivalDetector — detects when a bus arrives at a stop and buffers events for persistence.
 *
 * Requirements:
 * - checkArrival(bus, previousProgressM, currentProgressM, route):
 *   - A bus "arrives" at stop when progressM crosses the stop's offsetM
 *     OR when bus is within 40m of stop
 *   - Returns { busId, routeId, tripId, stopId, ts, delayS, headwayS } or null
 *   - headwayS: time since previous arrival of same route at that stop (seconds)
 *   - delayS: difference vs planned headway (configurable per route, default 10 min = 600s)
 *   - Uses UNIQUE (busId, tripId, stopId) to prevent duplicates
 * - flushArrivals(): returns buffered arrivals and clears buffer
 * - Internal buffer for batch writing
 */

export class ArrivalDetector {
  /**
   * @param {object} [options]
   * @param {number} [options.proximityM=40]
   * @param {number} [options.defaultPlannedHeadwayS=600] // 10 minutes
   * @param {Map|object} [options.plannedHeadways]       // routeId → headway in seconds
   */
  constructor(options = {}) {
    this._proximityM = options.proximityM ?? 40;
    this._defaultPlannedHeadwayS = options.defaultPlannedHeadwayS ?? 600;

    // Configurable planned headway per route
    this._plannedHeadways = new Map();
    if (options.plannedHeadways) {
      const entries = options.plannedHeadways instanceof Map
        ? options.plannedHeadways.entries()
        : Object.entries(options.plannedHeadways);
      for (const [k, v] of entries) {
        this._plannedHeadways.set(k, v);
      }
    }

    // Set of `${busId}:${tripId}:${stopId}`
    this._seen = new Set();

    // Map of `${routeId}:${stopId}` → lastArrivalTimestampMs
    this._lastArrivals = new Map();

    // Internal buffer for batch writing
    this._buffer = [];
  }

  /**
   * Set planned headway for a specific route in seconds.
   * @param {string} routeId
   * @param {number} headwayS
   */
  setPlannedHeadway(routeId, headwayS) {
    this._plannedHeadways.set(routeId, headwayS);
  }

  /**
   * Get planned headway for a route (or default 600s).
   * @param {string} routeId
   * @returns {number}
   */
  getPlannedHeadway(routeId) {
    return this._plannedHeadways.get(routeId) ?? this._defaultPlannedHeadwayS;
  }

  /**
   * Check whether the bus arrived at any stop on the route during this update.
   *
   * @param {object} bus
   * @param {number} previousProgressM
   * @param {number} currentProgressM
   * @param {object} route
   * @returns {{ busId: string, routeId: string, tripId: string, stopId: string, ts: Date, delayS: number|null, headwayS: number|null }|null}
   */
  checkArrival(bus, previousProgressM, currentProgressM, route) {
    if (!bus || !route) return null;

    const stops = route.stops;
    if (!Array.isArray(stops) || stops.length === 0) return null;

    const busId = bus._id || bus.busId;
    const routeId = bus.routeId || route._id || route.routeNo;
    const tripId = bus.tripId || 'T-DEFAULT';

    let ts = bus.ts ? new Date(bus.ts) : new Date();
    if (isNaN(ts.getTime())) {
      ts = new Date();
    }
    const nowMs = ts.getTime();

    // Check each stop along the route
    for (const stop of stops) {
      const stopId = stop.stopId || stop._id;
      const offsetM = stop.offsetM;
      if (offsetM == null) continue;

      const dedupKey = `${busId}:${tripId}:${stopId}`;
      if (this._seen.has(dedupKey)) {
        continue;
      }

      // Crossing: bus was strictly before offsetM and now is at or past offsetM
      const crossed = (previousProgressM < offsetM && currentProgressM >= offsetM);

      // Proximity: bus is within proximity threshold (e.g. 40m)
      const proximity = Math.abs(currentProgressM - offsetM) <= this._proximityM;

      if (crossed || proximity) {
        // Mark as seen so this bus doesn't re-trigger arrival at this stop on the same trip
        this._seen.add(dedupKey);

        // Headway calculation: time since previous arrival of same route at this stop
        const headwayKey = `${routeId}:${stopId}`;
        const lastArrivalMs = this._lastArrivals.get(headwayKey);
        let headwayS = null;
        let delayS = null;

        const plannedHeadwayS = this.getPlannedHeadway(routeId);

        if (lastArrivalMs != null) {
          headwayS = Math.max(0, Math.round((nowMs - lastArrivalMs) / 1000));
          // delayS: difference vs planned headway
          delayS = headwayS - plannedHeadwayS;
        } else {
          // If no previous arrival, delay vs schedule can be 0 or null
          delayS = 0;
        }

        this._lastArrivals.set(headwayKey, nowMs);

        const arrivalRecord = {
          busId,
          routeId,
          tripId,
          stopId,
          ts,
          delayS,
          headwayS,
        };

        this._buffer.push(arrivalRecord);
        return arrivalRecord;
      }
    }

    return null;
  }

  /**
   * Returns all buffered arrivals and clears the internal buffer.
   * @returns {Array<object>}
   */
  flushArrivals() {
    const flushed = this._buffer;
    this._buffer = [];
    return flushed;
  }

  /**
   * Number of items currently buffered.
   */
  get bufferSize() {
    return this._buffer.length;
  }

  /**
   * Reset internal deduplication cache and last arrivals (e.g. for testing or day rollover).
   */
  reset() {
    this._seen.clear();
    this._lastArrivals.clear();
    this._buffer = [];
  }
}

export default ArrivalDetector;
