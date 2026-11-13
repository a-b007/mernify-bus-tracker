import { ALERT_TYPE, ALERT_COOLDOWN_MS, STUCK_SPEED_KMH, STUCK_DURATION_S, BUNCHING_THRESHOLD_M } from '../utils/constants.js';
import { haversineM } from '../utils/geo.js';

// Cooldown map: key = `${busId}:${alertType}` -> timestamp of last fired alert
const alertCooldowns = new Map();

// Track low speed start time: busId -> { ts, lat, lng }
const stuckTracker = new Map();

// In-memory alert buffer for batched persistence & broadcast
const alertQueue = [];

// Depot coordinates for geofence checks (approximate coordinates in Bengaluru)
export const DEPOT_LOCATIONS = {
  Shantinagar: { lat: 12.9562, lng: 77.5921, radiusM: 300 },
  Yeshwantpur: { lat: 13.0234, lng: 77.5501, radiusM: 300 },
  Peenya: { lat: 13.0285, lng: 77.5180, radiusM: 300 },
  Banashankari: { lat: 12.9255, lng: 77.5468, radiusM: 300 },
  Koramangala: { lat: 12.9352, lng: 77.6245, radiusM: 300 },
  Yelahanka: { lat: 13.1005, lng: 77.5964, radiusM: 300 },
  'KR Puram': { lat: 13.0008, lng: 77.6936, radiusM: 300 },
  Whitefield: { lat: 12.9698, lng: 77.7499, radiusM: 300 },
  'Electronic City': { lat: 12.8458, lng: 77.6603, radiusM: 300 },
  Hebbal: { lat: 13.0358, lng: 77.5970, radiusM: 300 },
};

// Track depot state: busId -> insideDepot (boolean)
const depotStateTracker = new Map();

/**
 * Check if alert type is on cooldown for a bus.
 */
function isOnCooldown(busId, type, now) {
  const key = `${busId}:${type}`;
  const lastTime = alertCooldowns.get(key);
  if (lastTime && (now - lastTime) < ALERT_COOLDOWN_MS) {
    return true;
  }
  return false;
}

/**
 * Record alert firing time.
 */
function markFired(busId, type, now) {
  const key = `${busId}:${type}`;
  alertCooldowns.set(key, now);
}

/**
 * Create and queue an alert.
 */
export function createAlert(type, busId, routeId, details = {}, now = Date.now()) {
  const alert = {
    type,
    busId,
    routeId,
    ts: new Date(now),
    details,
  };
  alertQueue.push(alert);
  return alert;
}

/**
 * Drain queued alerts.
 */
export function drainAlerts() {
  const alerts = [...alertQueue];
  alertQueue.length = 0;
  return alerts;
}

/**
 * Check STUCK alert:
 * speed < 2 km/h for > 180s, not near a stop or terminus
 */
export function checkStuck(busState, stopsOnRoute = [], now = Date.now()) {
  const { busId, routeId, speed, lat, lng } = busState;

  if (speed <= STUCK_SPEED_KMH) {
    if (!stuckTracker.has(busId)) {
      stuckTracker.set(busId, { startTs: now, lat, lng });
    } else {
      const entry = stuckTracker.get(busId);
      const durationS = (now - entry.startTs) / 1000;
      if (durationS >= STUCK_DURATION_S) {
        // Check if near any stop or terminus (within 60m)
        const nearStop = stopsOnRoute.some(stop => {
          if (!stop.loc || !stop.loc.coordinates) return false;
          const [stopLng, stopLat] = stop.loc.coordinates;
          return haversineM(lat, lng, stopLat, stopLng) < 60;
        });

        if (!nearStop && !isOnCooldown(busId, ALERT_TYPE.STUCK, now)) {
          markFired(busId, ALERT_TYPE.STUCK, now);
          return createAlert(ALERT_TYPE.STUCK, busId, routeId, {
            stuckSince: new Date(entry.startTs).toISOString(),
            durationS: Math.round(durationS),
            location: [lng, lat],
          }, now);
        }
      }
    }
  } else {
    // Reset tracker if moving
    stuckTracker.delete(busId);
  }
  return null;
}

/**
 * Check BUNCHING alert:
 * Two buses on the same route/direction < 200m apart
 */
export function checkBunching(busState, allBusesOnRoute = [], now = Date.now()) {
  const { busId, routeId, lat, lng, progressM } = busState;

  for (const other of allBusesOnRoute) {
    if (other.busId === busId) continue;
    
    // Check progress distance or geographic distance
    let distM = Infinity;
    if (progressM !== undefined && other.progressM !== undefined) {
      distM = Math.abs(progressM - other.progressM);
    } else if (other.lat && other.lng) {
      distM = haversineM(lat, lng, other.lat, other.lng);
    }

    if (distM < BUNCHING_THRESHOLD_M) {
      if (!isOnCooldown(busId, ALERT_TYPE.BUNCHING, now) && !isOnCooldown(other.busId, ALERT_TYPE.BUNCHING, now)) {
        markFired(busId, ALERT_TYPE.BUNCHING, now);
        markFired(other.busId, ALERT_TYPE.BUNCHING, now);
        return createAlert(ALERT_TYPE.BUNCHING, busId, routeId, {
          otherBusId: other.busId,
          distanceM: Math.round(distM),
          location: [lng, lat],
        }, now);
      }
    }
  }
  return null;
}

/**
 * Check GEOFENCE alert:
 * Bus enters or leaves depot polygon / zone
 */
export function checkGeofence(busState, depotName, now = Date.now()) {
  const { busId, routeId, lat, lng } = busState;
  const depot = DEPOT_LOCATIONS[depotName];
  if (!depot) return null;

  const distToDepot = haversineM(lat, lng, depot.lat, depot.lng);
  const isInside = distToDepot <= depot.radiusM;
  const wasInside = depotStateTracker.get(busId);

  depotStateTracker.set(busId, isInside);

  if (wasInside !== undefined && wasInside !== isInside) {
    if (!isOnCooldown(busId, ALERT_TYPE.GEOFENCE, now)) {
      markFired(busId, ALERT_TYPE.GEOFENCE, now);
      return createAlert(ALERT_TYPE.GEOFENCE, busId, routeId, {
        event: isInside ? 'ENTERED_DEPOT' : 'LEFT_DEPOT',
        depot: depotName,
        distanceM: Math.round(distToDepot),
        location: [lng, lat],
      }, now);
    }
  }
  return null;
}

/**
 * Check DELAY_SPIKE alert:
 * Route avg delay > 2x hourly average
 */
export function checkDelaySpike(routeId, currentDelayS, hourlyAvgDelayS, now = Date.now()) {
  if (hourlyAvgDelayS > 60 && currentDelayS > 2 * hourlyAvgDelayS) {
    const key = `route:${routeId}`;
    if (!isOnCooldown(key, ALERT_TYPE.DELAY_SPIKE, now)) {
      markFired(key, ALERT_TYPE.DELAY_SPIKE, now);
      return createAlert(ALERT_TYPE.DELAY_SPIKE, `ROUTE_${routeId}`, routeId, {
        currentDelayS,
        hourlyAvgDelayS,
        ratio: (currentDelayS / hourlyAvgDelayS).toFixed(1),
      }, now);
    }
  }
  return null;
}
