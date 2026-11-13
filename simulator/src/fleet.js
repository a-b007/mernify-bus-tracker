/**
 * fleet.js — Fleet state machine for Bengaluru bus simulator.
 *
 * States: RUNNING, DWELLING, RESTING, BROKEN_DOWN
 */

import along from "@turf/along";
import { lineString } from "@turf/helpers";
import turfLength from "@turf/length";
import { computeSpeed, applyRedLight } from "./physics.js";

// ─── Constants ───────────────────────────────────────────────────────
const DWELL_MIN_S = 15;
const DWELL_MAX_S = 40;
const REST_MIN_S = 180; // 3 min
const REST_MAX_S = 480; // 8 min
const RED_LIGHT_CHECK_INTERVAL_M = 500;

const BUS_CAPACITY = {
  NON_AC: 56,
  AC: 45,
  EV: 40,
};

// ─── Helpers ─────────────────────────────────────────────────────────

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

let tripCounter = 0;
function newTripId(routeId) {
  return `${routeId}-T${++tripCounter}`;
}

/**
 * Compute heading (0-359) from two [lng, lat] points.
 */
function computeHeading(prev, cur) {
  if (!prev || !cur) return 0;
  const dLng = cur[0] - prev[0];
  const dLat = cur[1] - prev[1];
  let angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  return ((angle % 360) + 360) % 360;
}

/**
 * Get the route length in metres.
 */
function routeLengthM(route) {
  if (route._lengthM != null) return route._lengthM;
  const ls = lineString(route.geometry.coordinates);
  route._lengthM = turfLength(ls, { units: "meters" });
  return route._lengthM;
}

/**
 * Get [lng, lat] at a given distance along the route.
 */
function positionAt(route, distanceM) {
  const ls = lineString(route.geometry.coordinates);
  const pt = along(ls, distanceM / 1000, { units: "kilometers" });
  return pt.geometry.coordinates; // [lng, lat]
}

/**
 * Find the stop indices along the route for dwell triggers.
 * Returns array of progressM values where stops are.
 */
function stopPositions(route) {
  if (route._stopPositionsM) return route._stopPositionsM;
  if (!route.stops || route.stops.length === 0) {
    // Create artificial stops every 800-1200m
    const len = routeLengthM(route);
    const positions = [];
    let p = 800;
    while (p < len - 200) {
      positions.push(p);
      p += 800 + Math.random() * 400;
    }
    route._stopPositionsM = positions;
    return positions;
  }
  // If stops have distanceM or offsetM, use those. Otherwise space evenly.
  route._stopPositionsM = route.stops.map((s) => s.distanceM ?? s.offsetM ?? 0);
  return route._stopPositionsM;
}

// ─── Bus Object Factory ──────────────────────────────────────────────

/**
 * Create a single bus object.
 *
 * @param {string} busId
 * @param {string} regNo      — KA-57-F-XXXX
 * @param {string} busType    — NON_AC | AC | EV
 * @param {object} route      — route object with geometry.coordinates
 * @param {string} routeId
 * @param {number} [startM]   — initial progressM (random if omitted)
 */
export function createBus(busId, regNo, busType, route, routeId, startM) {
  const len = routeLengthM(route);
  const progressM = startM ?? Math.random() * len;
  const pos = positionAt(route, progressM);

  return {
    busId,
    regNo,
    busType,
    routeId,
    route,
    tripId: newTripId(routeId),
    progressM,
    speed: 0,
    heading: 0,
    occ: Math.floor(Math.random() * 20),
    seq: 0,
    state: "RUNNING",
    capacity: BUS_CAPACITY[busType] ?? 56,
    dwellTimer: 0,
    restTimer: 0,
    redLightTimer: 0,
    breakdownTimer: 0,
    lastPos: null,
    curPos: pos,
    lastRedLightCheckM: progressM,
    direction: "UP", // UP or DN
    reverseRoute: null, // set externally if available
  };
}

// ─── Tick Logic ──────────────────────────────────────────────────────

/**
 * Advance one bus by dt seconds in simulation time.
 *
 * @param {object} bus     — bus state
 * @param {number} dt      — elapsed sim-seconds
 * @param {number} simHour — current sim-time hour (0-23)
 * @returns {object|null}  — telemetry event (or null if no update)
 */
export function tickBus(bus, dt, simHour) {
  bus.seq++;

  switch (bus.state) {
    case "BROKEN_DOWN":
      bus.speed = 0;
      bus.breakdownTimer -= dt;
      if (bus.breakdownTimer <= 0) {
        bus.state = "RUNNING";
        bus.breakdownTimer = 0;
      }
      break;

    case "DWELLING":
      bus.speed = 0;
      bus.dwellTimer -= dt;
      if (bus.dwellTimer <= 0) {
        bus.state = "RUNNING";
        bus.dwellTimer = 0;
      }
      break;

    case "RESTING":
      bus.speed = 0;
      bus.restTimer -= dt;
      if (bus.restTimer <= 0) {
        // Reverse direction
        bus.state = "RUNNING";
        bus.restTimer = 0;
        bus.progressM = 0;
        bus.direction = bus.direction === "UP" ? "DN" : "UP";
        if (bus.reverseRoute) {
          // Swap route and reverseRoute
          const tmp = bus.route;
          bus.route = bus.reverseRoute;
          bus.reverseRoute = tmp;
          const baseId = bus.routeId.replace(/-UP$|-DN$/, "");
          bus.routeId = `${baseId}-${bus.direction}`;
        }
        bus.tripId = newTripId(bus.routeId);
      }
      break;

    case "RUNNING":
    default: {
      // Red-light wait
      if (bus.redLightTimer > 0) {
        bus.speed = 0;
        bus.redLightTimer -= dt;
        if (bus.redLightTimer < 0) bus.redLightTimer = 0;
        break;
      }

      const speed = computeSpeed(bus.busType, simHour, true);
      bus.speed = speed;

      // Convert speed km/h → m/s, advance
      const advanceM = (speed / 3.6) * dt;
      const prevProgressM = bus.progressM;
      bus.progressM += advanceM;

      // Check for red lights every 500m
      if (
        Math.floor(bus.progressM / RED_LIGHT_CHECK_INTERVAL_M) >
        Math.floor(bus.lastRedLightCheckM / RED_LIGHT_CHECK_INTERVAL_M)
      ) {
        bus.lastRedLightCheckM = bus.progressM;
        applyRedLight(bus);
      }

      // Check for stop dwell
      const stops = stopPositions(bus.route);
      for (const stopM of stops) {
        if (prevProgressM < stopM && bus.progressM >= stopM) {
          // Arrived at a stop → dwell
          bus.state = "DWELLING";
          bus.speed = 0;
          bus.dwellTimer = randomBetween(DWELL_MIN_S, DWELL_MAX_S);
          bus.progressM = stopM;

          // Passenger exchange
          const alightFrac = 0.1 + Math.random() * 0.2; // 10-30%
          const alighting = Math.floor(bus.occ * alightFrac);
          const boarding = Math.floor(5 + Math.random() * 20); // 5-25
          bus.occ = Math.min(bus.capacity, Math.max(0, bus.occ - alighting + boarding));
          break;
        }
      }

      // Check if reached end of route → rest at terminus
      const len = routeLengthM(bus.route);
      if (bus.progressM >= len) {
        bus.progressM = len - 1; // clamp
        bus.state = "RESTING";
        bus.speed = 0;
        bus.restTimer = randomBetween(REST_MIN_S, REST_MAX_S);
      }

      break;
    }
  }

  // Update position
  bus.lastPos = bus.curPos;
  try {
    bus.curPos = positionAt(bus.route, Math.max(0, Math.min(bus.progressM, routeLengthM(bus.route) - 1)));
  } catch {
    // keep previous position on error
  }

  // Heading from consecutive positions
  if (bus.lastPos && bus.curPos) {
    const h = computeHeading(bus.lastPos, bus.curPos);
    if (bus.speed > 0.5) bus.heading = Math.round(h);
  }

  // Build telemetry event
  return {
    busId: bus.busId,
    seq: bus.seq,
    ts: Date.now(),
    lat: parseFloat((bus.curPos[1]).toFixed(5)),
    lng: parseFloat((bus.curPos[0]).toFixed(5)),
    speed: parseFloat(bus.speed.toFixed(1)),
    heading: bus.heading,
    occ: bus.occ,
  };
}
