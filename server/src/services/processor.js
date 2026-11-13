import fs from 'fs';
import path from 'path';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { point, lineString } from '@turf/helpers';
import {
  EMA_ALPHA,
  ARRIVAL_THRESHOLD_M,
  MAX_BACKWARD_JUMP_M,
  latLngToCellId,
  encodeCoord,
} from '../utils/constants.js';
import {
  checkStuck,
  checkBunching,
  checkGeofence,
  createAlert,
  drainAlerts,
} from './alerts.js';

// Static metadata in-memory
const stopsMap = new Map(); // stopId -> stopDoc
const routesMap = new Map(); // routeId -> routeDoc (with cached turfLineString)
const busesMetaMap = new Map(); // busId -> busDoc

// Live state in-memory
// busId -> busState
const busStates = new Map();

// Map busId to array index for compact delta streaming
const busIndexMap = new Map();
const busIdByIndex = [];

// Track changed buses since last delta broadcast: Set<busId>
const dirtyBuses = new Set();

// Buffers for persistence
const arrivalQueue = [];
const historyQueue = []; // sample 1 in 15

// Track arrivals per bus/trip: key = `${busId}:${tripId}:${stopId}`
const recordedArrivals = new Set();

// Sequence counter for delta batches
let deltaBatchSeq = 0;

/**
 * Load static stops, routes, and buses into memory.
 */
export function loadStaticData(dataDir = null) {
  const searchDirs = [
    dataDir,
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '../data'),
    path.resolve(process.cwd(), 'server/src/data'),
    path.resolve(process.cwd(), 'src/data'),
  ].filter(Boolean);

  let loaded = false;

  for (const dir of searchDirs) {
    const stopsPath = path.join(dir, 'stops.json');
    const routesPath = path.join(dir, 'routes.json');
    const busesPath = path.join(dir, 'buses.json');

    if (fs.existsSync(stopsPath) && fs.existsSync(routesPath) && fs.existsSync(busesPath)) {
      try {
        const stops = JSON.parse(fs.readFileSync(stopsPath, 'utf8'));
        const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
        const buses = JSON.parse(fs.readFileSync(busesPath, 'utf8'));

        setStaticData({ stops, routes, buses });
        console.log(`[processor] Loaded static data from ${dir}: ${stops.length} stops, ${routes.length} routes, ${buses.length} buses`);
        loaded = true;
        break;
      } catch (err) {
        console.warn(`[processor] Failed to parse data from ${dir}:`, err.message);
      }
    }
  }

  if (!loaded) {
    console.warn('[processor] Static data files (stops, routes, buses) not found yet in standard paths.');
  }
}

/**
 * Explicitly set static data from in-memory arrays (used by tests or seed).
 */
export function setStaticData({ stops = [], routes = [], buses = [] }) {
  stopsMap.clear();
  for (const stop of stops) {
    stopsMap.set(stop._id, stop);
  }

  routesMap.clear();
  for (const route of routes) {
    let turfLine = null;
    if (route.geometry && route.geometry.coordinates && route.geometry.coordinates.length >= 2) {
      turfLine = lineString(route.geometry.coordinates);
    }
    // Sort stops monotonically by offsetM if not sorted
    const sortedStops = route.stops ? [...route.stops].sort((a, b) => a.offsetM - b.offsetM) : [];
    routesMap.set(route._id, {
      ...route,
      stops: sortedStops,
      turfLine,
    });
  }

  busesMetaMap.clear();
  busIndexMap.clear();
  busIdByIndex.length = 0;

  for (let i = 0; i < buses.length; i++) {
    const bus = buses[i];
    busesMetaMap.set(bus._id, bus);
    busIndexMap.set(bus._id, i);
    busIdByIndex.push(bus._id);
  }
}

/**
 * Get or assign numeric index for a bus.
 */
export function getBusIndex(busId) {
  if (busIndexMap.has(busId)) {
    return busIndexMap.get(busId);
  }
  const idx = busIdByIndex.length;
  busIndexMap.set(busId, idx);
  busIdByIndex.push(busId);
  return idx;
}

/**
 * Get bus ID from numeric index.
 */
export function getBusIdByIndex(idx) {
  return busIdByIndex[idx] || null;
}

/**
 * Main ingestion method: process an array of telemetry events.
 */
export function processBatch(events) {
  const processed = [];
  const rejected = [];
  const newArrivals = [];
  const newAlerts = [];

  for (const event of events) {
    const result = processEvent(event);
    if (result.success) {
      processed.push(result.state);
      if (result.arrival) newArrivals.push(result.arrival);
      if (result.alerts && result.alerts.length > 0) newAlerts.push(...result.alerts);
    } else {
      rejected.push({ event, reason: result.reason });
    }
  }

  return {
    processedCount: processed.length,
    rejectedCount: rejected.length,
    rejected,
    newArrivals,
    newAlerts,
  };
}

/**
 * Process a single telemetry event.
 */
export function processEvent(event) {
  const { busId, seq, ts, lat, lng, speed, heading, occ } = event;
  const prevState = busStates.get(busId);

  // 1. Check seq > lastSeq
  if (prevState && seq <= prevState.seq) {
    return { success: false, reason: `Stale sequence: ${seq} <= ${prevState.seq}` };
  }

  // Get bus registration / route
  const busMeta = busesMetaMap.get(busId) || {};
  const routeId = prevState?.routeId || busMeta.routeId;
  const route = routeId ? routesMap.get(routeId) : null;

  // 2. Snap lat/lng to route polyline if geometry exists
  let progressM = prevState ? prevState.progressM : 0;
  if (route && route.turfLine) {
    try {
      const pt = point([lng, lat]);
      const snapped = nearestPointOnLine(route.turfLine, pt, { units: 'meters' });
      if (snapped && snapped.properties && typeof snapped.properties.location === 'number') {
        progressM = Math.round(snapped.properties.location);
      }
    } catch (e) {
      // fallback to previous progressM
    }
  }

  // 3. Reject impossible jumps
  if (prevState && prevState.progressM !== undefined && prevState.ts) {
    const deltaProgress = progressM - prevState.progressM;
    const elapsedS = Math.max(0.1, (ts - prevState.ts) / 1000);

    // Backward jump > 50m
    if (deltaProgress < -MAX_BACKWARD_JUMP_M) {
      return { success: false, reason: `Impossible backward jump: ${deltaProgress}m` };
    }

    // Forward jump > speed * elapsed * 2
    // Convert speed km/h to m/s: (speed / 3.6)
    const maxSpeedMs = Math.max(speed, prevState.speed, 20) / 3.6;
    const maxAllowedForward = (maxSpeedMs * elapsedS * 2) + 60; // 60m margin
    if (deltaProgress > maxAllowedForward) {
      return { success: false, reason: `Impossible forward jump: ${deltaProgress}m in ${elapsedS}s (max ${maxAllowedForward}m)` };
    }
  }

  // 4. Update EMA speed (α ≈ 0.1)
  const prevEma = prevState ? prevState.emaSpeed : undefined;
  const emaSpeed = prevEma !== undefined
    ? Number((EMA_ALPHA * speed + (1 - EMA_ALPHA) * prevEma).toFixed(1))
    : speed;

  // 5. Compute nextStopId
  let nextStopId = null;
  let delayS = 0;
  if (route && route.stops && route.stops.length > 0) {
    for (const stop of route.stops) {
      if (stop.offsetM > progressM) {
        nextStopId = stop.stopId;
        break;
      }
    }
    if (!nextStopId) {
      nextStopId = route.stops[route.stops.length - 1].stopId;
    }
  }

  // Trip ID (synthesized or preserved)
  const tripId = prevState?.tripId || `TRIP-${busId}-${Math.floor(ts / (3600 * 1000 * 4))}`;

  // 6. Detect arrivals
  let detectedArrival = null;
  if (route && route.stops) {
    for (const s of route.stops) {
      const arrivalKey = `${busId}:${tripId}:${s.stopId}`;
      if (!recordedArrivals.has(arrivalKey)) {
        const distToStopOffset = Math.abs(progressM - s.offsetM);
        const prevOffset = prevState ? prevState.progressM : 0;
        const crossed = prevOffset < s.offsetM && progressM >= s.offsetM;

        if (distToStopOffset <= ARRIVAL_THRESHOLD_M || crossed) {
          recordedArrivals.add(arrivalKey);
          detectedArrival = {
            busId,
            routeId,
            tripId,
            stopId: s.stopId,
            ts: new Date(ts),
            delayS: Math.round(delayS),
            headwayS: 300, // typical nominal headway
          };
          arrivalQueue.push(detectedArrival);
          break;
        }
      }
    }
  }

  // Cell ID for spatial partitioning
  const cellId = latLngToCellId(lat, lng);

  // New bus state
  const newState = {
    _id: busId,
    busId,
    routeId,
    tripId,
    seq,
    ts,
    lat,
    lng,
    speed,
    heading,
    occ: occ !== undefined ? occ : (prevState?.occ || 0),
    progressM,
    nextStopId,
    delayS,
    emaSpeed,
    cellId,
    loc: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    updatedAt: Date.now(),
  };

  // Update in-memory state
  busStates.set(busId, newState);
  dirtyBuses.add(busId);

  // History sample: 1 in 15 events
  if (seq % 15 === 0) {
    historyQueue.push({
      ts: new Date(ts),
      meta: { busId, routeId },
      lat,
      lng,
      speed,
      progressM,
      occ: newState.occ,
      seq,
    });
  }

  // 7. Check anomalies (stuck, bunching, geofence)
  const firedAlerts = [];
  const routeStops = route?.stops ? route.stops.map(s => stopsMap.get(s.stopId)).filter(Boolean) : [];
  
  const stuckAlert = checkStuck(newState, routeStops, ts);
  if (stuckAlert) firedAlerts.push(stuckAlert);

  if (routeId) {
    const busesOnSameRoute = [];
    for (const st of busStates.values()) {
      if (st.routeId === routeId) busesOnSameRoute.push(st);
    }
    const bunchingAlert = checkBunching(newState, busesOnSameRoute, ts);
    if (bunchingAlert) firedAlerts.push(bunchingAlert);
  }

  if (busMeta.depot) {
    const geoAlert = checkGeofence(newState, busMeta.depot, ts);
    if (geoAlert) firedAlerts.push(geoAlert);
  }

  return {
    success: true,
    state: newState,
    arrival: detectedArrival,
    alerts: firedAlerts,
  };
}

/**
 * Return all current bus states.
 */
export function getState() {
  return Array.from(busStates.values());
}

/**
 * Return bus states located in the given grid cells.
 */
export function getStateForCells(cellIds) {
  const cellSet = new Set(cellIds);
  const result = [];
  for (const state of busStates.values()) {
    if (cellSet.has(state.cellId)) {
      result.push(state);
    }
  }
  return result;
}

/**
 * Return a single bus state.
 */
export function getBusState(busId) {
  return busStates.get(busId) || null;
}

/**
 * Return metadata for a bus.
 */
export function getBusMeta(busId) {
  return busesMetaMap.get(busId) || null;
}

/**
 * Get all routes metadata.
 */
export function getAllRoutes() {
  return Array.from(routesMap.values()).map(r => {
    const { turfLine, ...rest } = r;
    return rest;
  });
}

/**
 * Get route by ID.
 */
export function getRoute(routeId) {
  const route = routesMap.get(routeId);
  if (!route) return null;
  const { turfLine, ...rest } = route;
  return rest;
}

/**
 * Get all stops.
 */
export function getAllStops() {
  return Array.from(stopsMap.values());
}

/**
 * Get stop by ID.
 */
export function getStop(stopId) {
  return stopsMap.get(stopId) || null;
}

/**
 * Build compact delta payload for moved buses and reset dirty set.
 * Format per contract: { batchSeq, t, rows: [[idx, lat*1e5, lng*1e5, speed*10, hdg, seq], ...] }
 */
export function getDeltaPayload() {
  if (dirtyBuses.size === 0) {
    return null;
  }

  const rows = [];
  const now = Date.now();
  deltaBatchSeq++;

  for (const busId of dirtyBuses) {
    const s = busStates.get(busId);
    if (!s) continue;

    const idx = getBusIndex(busId);
    rows.push([
      idx,
      encodeCoord(s.lat),
      encodeCoord(s.lng),
      Math.round(s.speed * 10),
      s.heading,
      s.seq,
    ]);
  }

  dirtyBuses.clear();

  return {
    batchSeq: deltaBatchSeq,
    t: now,
    rows,
  };
}

/**
 * Drain queued arrival events for batched DB persistence.
 */
export function drainArrivals() {
  const items = [...arrivalQueue];
  arrivalQueue.length = 0;
  return items;
}

/**
 * Drain queued historical position samples for batched DB persistence.
 */
export function drainPositions() {
  const items = [...historyQueue];
  historyQueue.length = 0;
  return items;
}
