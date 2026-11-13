/**
 * ETAService — computes live ETA predictions for bus stops.
 *
 * Constructor:
 *   new ETAService({ routes, busState, hourlyStats })
 *   or new ETAService(routes, busState, hourlyStats)
 *
 * Algorithm per specification:
 * for each route R serving stop S:
 *     offset = R.stopOffset[S]   // metres from route start
 *     for each live bus b on R (lastSeen < 30s ago):
 *         remaining = offset - b.progressM
 *         if remaining < -30: continue   // already passed
 *         v = max(blend(b.emaSpeed, segmentAvgSpeed(R, b.progressM, hourNow)), 8)  // km/h, min 8
 *         stopsBetween = count of R stops between b.progressM and offset
 *         eta = remaining / (v * 1000/3600) + stopsBetween * avgDwell(R, hourNow)  // seconds
 *         candidates.push({busId, routeNo: R.routeNo, etaS: Math.round(eta), confidence})
 * return candidates.sort(by etaS).slice(0, 3)
 */

export class ETAService {
  /**
   * @param {object|Map|Array} routesOrDeps
   * @param {Map|object} [busState]
   * @param {Map|object} [hourlyStats]
   */
  constructor(routesOrDeps = {}, busState = null, hourlyStats = null) {
    let routes = routesOrDeps;
    let bState = busState;
    let hStats = hourlyStats;

    // Support both new ETAService({ routes, busState, hourlyStats })
    // and new ETAService(routes, busState, hourlyStats)
    if (routesOrDeps && typeof routesOrDeps === 'object' && !Array.isArray(routesOrDeps) && !(routesOrDeps instanceof Map)) {
      if ('routes' in routesOrDeps || 'busState' in routesOrDeps || 'hourlyStats' in routesOrDeps) {
        routes = routesOrDeps.routes;
        bState = routesOrDeps.busState;
        hStats = routesOrDeps.hourlyStats;
      }
    }

    this._routes = new Map();
    this.setRoutes(routes || []);

    this._busState = new Map();
    this.setBusState(bState || new Map());

    this._hourlyStats = new Map();
    this.setHourlyStats(hStats || new Map());

    // Subscriber tracking for Socket.IO (stopId → count)
    this._subscribers = new Map();
  }

  /**
   * Update routes data.
   * @param {Map|Array|object} routes
   */
  setRoutes(routes) {
    this._routes.clear();
    this._stopRouteIndex = new Map();

    if (!routes) return;

    const entries = routes instanceof Map
      ? routes.entries()
      : Array.isArray(routes)
        ? routes.map(r => [r._id || r.routeId, r])
        : Object.entries(routes);

    for (const [id, r] of entries) {
      this._routes.set(id, r);
      if (Array.isArray(r.stops)) {
        for (const s of r.stops) {
          const sid = s.stopId || s._id;
          if (!sid) continue;
          if (!this._stopRouteIndex.has(sid)) {
            this._stopRouteIndex.set(sid, new Set());
          }
          this._stopRouteIndex.get(sid).add(id);
        }
      } else if (r.stopOffset && typeof r.stopOffset === 'object') {
        const stopIds = r.stopOffset instanceof Map ? r.stopOffset.keys() : Object.keys(r.stopOffset);
        for (const sid of stopIds) {
          if (!this._stopRouteIndex.has(sid)) {
            this._stopRouteIndex.set(sid, new Set());
          }
          this._stopRouteIndex.get(sid).add(id);
        }
      }
    }
  }

  /**
   * Update live bus state map.
   * @param {Map|object|Array} busState
   */
  setBusState(busState) {
    if (busState instanceof Map) {
      this._busState = busState;
    } else if (Array.isArray(busState)) {
      this._busState = new Map(busState.map(b => [b._id || b.busId, b]));
    } else if (busState && typeof busState === 'object') {
      this._busState = new Map(Object.entries(busState));
    } else {
      this._busState = new Map();
    }
  }

  /**
   * Update a single bus's live state.
   * @param {string} busId
   * @param {object} state
   */
  updateBus(busId, state) {
    this._busState.set(busId, state);
  }

  /**
   * Update hourly stats cache.
   * @param {Map|object|Array} hourlyStats
   */
  setHourlyStats(hourlyStats) {
    if (hourlyStats instanceof Map) {
      this._hourlyStats = hourlyStats;
    } else if (Array.isArray(hourlyStats)) {
      this._hourlyStats = new Map(
        hourlyStats.map(s => [`${s.stopId}:${s.routeId}:${s.dayType}:${s.hour}`, s])
      );
    } else if (hourlyStats && typeof hourlyStats === 'object') {
      this._hourlyStats = new Map(Object.entries(hourlyStats));
    } else {
      this._hourlyStats = new Map();
    }
  }

  /**
   * Compute top 3 nearest buses with ETA for stopId.
   *
   * @param {string} stopId
   * @param {number} [currentTimeMs] - optional override for testing
   * @returns {Array<{busId: string, routeNo: string, etaS: number, confidence: 'high'|'medium'|'low', label?: string}>}
   */
  computeETAs(stopId, currentTimeMs = Date.now()) {
    const routeIds = this._stopRouteIndex.get(stopId);
    if (!routeIds || routeIds.size === 0) {
      return [];
    }

    const now = currentTimeMs;
    const hourNow = new Date(now).getUTCHours();
    const candidates = [];

    for (const routeId of routeIds) {
      const route = this._routes.get(routeId);
      if (!route) continue;

      // Determine stop offset from route start
      const offset = this._getStopOffset(route, stopId);
      if (offset === null || offset === undefined) continue;

      // Iterate through live buses on this route
      for (const [busId, bus] of this._busState) {
        if (!bus) continue;
        const bRouteId = bus.routeId || (route._id === bus.route ? route._id : null);
        if (bRouteId !== routeId && bus.routeId !== route._id) continue;

        // Freshness check: lastSeen < 30s ago
        const busTs = this._getBusTimestamp(bus, now);
        const ageS = Math.max(0, (now - busTs) / 1000);
        if (ageS >= 30) continue;

        const progressM = bus.progressM ?? 0;
        const remaining = offset - progressM;
        if (remaining < -30) continue; // Bus has already passed the stop

        // Speed calculation: max(blend(b.emaSpeed, segmentAvgSpeed(R, b.progressM, hourNow)), 8)
        const segSpeed = this.segmentAvgSpeed(route, progressM, hourNow);
        const blended = this._blend(bus.emaSpeed, segSpeed);
        const v = Math.max(blended, 8); // km/h, min 8

        // Count of stops between bus progress and target stop
        const stopsBetween = this._countStopsBetween(route, progressM, offset);
        const dwell = this.avgDwell(route, hourNow);

        // ETA calculation: remaining / (v * 1000/3600) + stopsBetween * avgDwell
        const travelSeconds = Math.max(remaining, 0) / (v * (1000 / 3600));
        const dwellSeconds = stopsBetween * dwell;
        const etaS = Math.max(0, Math.round(travelSeconds + dwellSeconds));

        // Confidence:
        // "high" if bus fresh (<10s) and within 3km (<3000m)
        // "medium" if <30s and <8km (<8000m)
        // "low" otherwise
        const remainingM = Math.max(remaining, 0);
        let confidence = 'low';
        if (ageS < 10 && remainingM < 3000) {
          confidence = 'high';
        } else if (ageS < 30 && remainingM < 8000) {
          confidence = 'medium';
        }

        const candidate = {
          busId: bus._id || bus.busId || busId,
          routeNo: route.routeNo || route.routeId || routeId,
          etaS,
          confidence,
        };

        if (etaS < 60) {
          candidate.label = 'Arriving';
        }

        candidates.push(candidate);
      }
    }

    // Sort by etaS ascending and take top 3
    candidates.sort((a, b) => a.etaS - b.etaS);
    return candidates.slice(0, 3);
  }

  /**
   * Blend live EMA speed with historical segment speed.
   */
  _blend(liveSpeed, histSpeed) {
    if (liveSpeed != null && !isNaN(liveSpeed) && liveSpeed > 0) {
      return (liveSpeed + histSpeed) / 2;
    }
    return histSpeed;
  }

  /**
   * Segment average speed from roll-ups, fallback to 25 km/h.
   * @param {object} route
   * @param {number} progressM
   * @param {number} hour
   * @returns {number} km/h
   */
  segmentAvgSpeed(route, progressM, hour) {
    if (!route) return 25;

    // Check hourly stats if available
    const dayType = this._dayType();
    const routeId = route._id || route.routeId;

    if (Array.isArray(route.stops)) {
      // Find the last stop passed
      const passed = route.stops.filter(s => s.offsetM <= progressM);
      const stop = passed.length > 0 ? passed[passed.length - 1] : route.stops[0];
      if (stop) {
        const key = `${stop.stopId}:${routeId}:${dayType}:${hour}`;
        const stat = this._hourlyStats.get(key);
        if (stat && stat.avgSpeedKmh != null && stat.avgSpeedKmh > 0) {
          return stat.avgSpeedKmh;
        }
      }
    }

    return route.defaultSpeed || 25;
  }

  /**
   * Average dwell time at stops from roll-ups, fallback 25s.
   * @param {object} route
   * @param {number} hour
   * @returns {number} seconds
   */
  avgDwell(route, hour) {
    if (!route) return 25;

    const dayType = this._dayType();
    const routeId = route._id || route.routeId;

    if (Array.isArray(route.stops)) {
      for (const s of route.stops) {
        const key = `${s.stopId}:${routeId}:${dayType}:${hour}`;
        const stat = this._hourlyStats.get(key);
        if (stat && stat.avgDwellS != null && stat.avgDwellS > 0) {
          return stat.avgDwellS;
        }
      }
    }

    return 25;
  }

  /**
   * Count stops on route between bus progress and target stop offset.
   */
  _countStopsBetween(route, progressM, stopOffset) {
    if (!route || !Array.isArray(route.stops)) return 0;
    return route.stops.filter(
      s => s.offsetM > progressM && s.offsetM < stopOffset
    ).length;
  }

  /**
   * Extract offsetM for a stop from a route.
   */
  _getStopOffset(route, stopId) {
    if (route.stopOffset) {
      if (route.stopOffset instanceof Map) {
        return route.stopOffset.get(stopId);
      }
      if (typeof route.stopOffset === 'object' && stopId in route.stopOffset) {
        return route.stopOffset[stopId];
      }
    }
    if (Array.isArray(route.stops)) {
      const match = route.stops.find(s => (s.stopId || s._id) === stopId);
      if (match) return match.offsetM;
    }
    return null;
  }

  /**
   * Extract timestamp in ms from bus object.
   */
  _getBusTimestamp(bus, fallbackNow) {
    if (typeof bus.ts === 'number') return bus.ts;
    if (bus.ts) return new Date(bus.ts).getTime();
    if (typeof bus.lastSeen === 'number') return bus.lastSeen;
    if (bus.lastSeen) return new Date(bus.lastSeen).getTime();
    return fallbackNow;
  }

  /**
   * Determine day type.
   */
  _dayType() {
    const day = new Date().getUTCDay();
    return (day === 0 || day === 6) ? 'WEEKEND' : 'WEEKDAY';
  }

  /**
   * Returns set of stopIds that have Socket.IO subscribers.
   * @returns {Set<string>}
   */
  getSubscribedStops() {
    const active = new Set();
    for (const [stopId, count] of this._subscribers) {
      if (count > 0) active.add(stopId);
    }
    return active;
  }

  /**
   * Track subscriber count for a stop.
   * @param {string} stopId
   * @param {number} count
   */
  setSubscribers(stopId, count) {
    if (count <= 0) {
      this._subscribers.delete(stopId);
    } else {
      this._subscribers.set(stopId, count);
    }
  }
}

let _defaultETAService = null;

/**
 * Configure default ETAService singleton.
 * @param {ETAService} service
 */
export function setDefaultETAService(service) {
  _defaultETAService = service;
}

/**
 * Retrieve active default ETAService singleton.
 * @returns {ETAService|null}
 */
export function getDefaultETAService() {
  return _defaultETAService;
}

/**
 * Convenience function for stops route handler.
 * @param {string} stopId
 * @returns {Promise<Array>}
 */
export async function computeStopETA(stopId) {
  if (!_defaultETAService) {
    try {
      const processor = await import('./processor.js');
      const routes = processor.getAllRoutes ? processor.getAllRoutes() : [];
      const busState = processor.getState ? processor.getState() : new Map();
      _defaultETAService = new ETAService({ routes, busState });
    } catch {
      return [];
    }
  }
  return _defaultETAService.computeETAs(stopId);
}

export default ETAService;
