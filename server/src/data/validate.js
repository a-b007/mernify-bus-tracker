#!/usr/bin/env node
/**
 * Validation script for Bengaluru Bus Digital Twin data files.
 * Verifies:
 * - Every stop's coordinates are within Bengaluru bbox (12.7-13.2 lat, 77.3-77.9 lng)
 * - Every route's stops exist in stops.json
 * - Every bus references a valid route
 * - offsetM increases monotonically per route
 * - Every stop referenced by a route has that route in its routeIds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory can be in ../../../data (workspace root) or passed via env / arg
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../../data');

console.log('=== BENGALURU BUS DIGITAL TWIN DATA VALIDATION ===');
console.log(`Checking data files in: ${DATA_DIR}\n`);

const errors = [];
const warnings = [];

// 1. Validate stops.json
const stopsPath = path.join(DATA_DIR, 'stops.json');
if (!fs.existsSync(stopsPath)) {
  console.error(`❌ Missing file: ${stopsPath}`);
  process.exit(1);
}

const stops = JSON.parse(fs.readFileSync(stopsPath, 'utf8'));
console.log(`✓ Loaded ${stops.length} stops from stops.json`);

const LAT_MIN = 12.7;
const LAT_MAX = 13.2;
const LNG_MIN = 77.3;
const LNG_MAX = 77.9;
const VALID_ZONES = new Set([
  'central', 'north', 'south', 'east', 'west',
  'southeast', 'northeast', 'northwest', 'southwest'
]);

const stopIds = new Set();
const stopsById = new Map();

for (const stop of stops) {
  const id = stop._id;
  if (!id) {
    errors.push('Found stop missing _id');
    continue;
  }
  if (stopIds.has(id)) {
    errors.push(`Duplicate stop _id: ${id}`);
  }
  stopIds.add(id);
  stopsById.set(id, stop);

  if (!stop.name || typeof stop.name !== 'string') {
    errors.push(`Stop ${id} missing or invalid name`);
  }

  if (!stop.loc || stop.loc.type !== 'Point' || !Array.isArray(stop.loc.coordinates)) {
    errors.push(`Stop ${id} has invalid GeoJSON Point loc`);
    continue;
  }

  const [lng, lat] = stop.loc.coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    errors.push(`Stop ${id} coordinates are not numbers`);
    continue;
  }

  if (lat < LAT_MIN || lat > LAT_MAX) {
    errors.push(`Stop ${id} (${stop.name}) latitude ${lat} outside Bengaluru bbox [${LAT_MIN}, ${LAT_MAX}]`);
  }
  if (lng < LNG_MIN || lng > LNG_MAX) {
    errors.push(`Stop ${id} (${stop.name}) longitude ${lng} outside Bengaluru bbox [${LNG_MIN}, ${LNG_MAX}]`);
  }

  if (!VALID_ZONES.has(stop.zone)) {
    warnings.push(`Stop ${id} has non-standard zone: '${stop.zone}'`);
  }
}

// 2. Validate routes.json
const routesPath = path.join(DATA_DIR, 'routes.json');
if (!fs.existsSync(routesPath)) {
  console.error(`❌ Missing file: ${routesPath}`);
  process.exit(1);
}

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
console.log(`✓ Loaded ${routes.length} routes from routes.json`);

const routeIds = new Set();
const stopRouteOccurrences = new Map();

for (const route of routes) {
  const rId = route._id;
  if (!rId) {
    errors.push('Found route missing _id');
    continue;
  }
  if (routeIds.has(rId)) {
    errors.push(`Duplicate route _id: ${rId}`);
  }
  routeIds.add(rId);

  if (!['UP', 'DN'].includes(route.direction)) {
    errors.push(`Route ${rId} has invalid direction '${route.direction}' (expected 'UP' or 'DN')`);
  }

  if (!route.geometry || route.geometry.type !== 'LineString' || !Array.isArray(route.geometry.coordinates)) {
    errors.push(`Route ${rId} has invalid LineString geometry`);
  }

  if (!Array.isArray(route.stops) || route.stops.length === 0) {
    errors.push(`Route ${rId} has empty or missing stops array`);
    continue;
  }

  if (route.stops.length < 15 || route.stops.length > 50) {
    warnings.push(`Route ${rId} has ${route.stops.length} stops (expected 15-50)`);
  }

  let prevOffset = -1;
  for (let idx = 0; idx < route.stops.length; idx++) {
    const rs = route.stops[idx];
    const sId = rs.stopId;

    if (!sId || !stopsById.has(sId)) {
      errors.push(`Route ${rId} references nonexistent stopId: '${sId}' at index ${idx}`);
    } else {
      const stopDoc = stopsById.get(sId);
      if (!Array.isArray(stopDoc.routeIds) || !stopDoc.routeIds.includes(rId)) {
        errors.push(`Stop ${sId} referenced by route ${rId} does not include '${rId}' in routeIds`);
      }
    }

    if (typeof rs.offsetM !== 'number') {
      errors.push(`Route ${rId} stop index ${idx} missing or invalid offsetM`);
    } else {
      if (rs.offsetM <= prevOffset) {
        errors.push(`Route ${rId} offsetM not monotonically increasing at index ${idx} (${rs.offsetM} <= ${prevOffset})`);
      }
      prevOffset = rs.offsetM;
    }
  }

  if (typeof route.lengthM !== 'number' || route.lengthM < prevOffset) {
    errors.push(`Route ${rId} lengthM (${route.lengthM}) is invalid or smaller than last stop offset (${prevOffset})`);
  }
}

// 3. Validate buses.json
const busesPath = path.join(DATA_DIR, 'buses.json');
if (!fs.existsSync(busesPath)) {
  console.error(`❌ Missing file: ${busesPath}`);
  process.exit(1);
}

const buses = JSON.parse(fs.readFileSync(busesPath, 'utf8'));
console.log(`✓ Loaded ${buses.length} buses from buses.json`);

const busIds = new Set();
const busesPerRoute = new Map();
const busTypes = { NON_AC: 0, AC: 0, EV: 0 };

for (const bus of buses) {
  const bId = bus._id;
  if (!bId) {
    errors.push('Found bus missing _id');
    continue;
  }
  if (busIds.has(bId)) {
    errors.push(`Duplicate bus _id: ${bId}`);
  }
  busIds.add(bId);

  if (!routeIds.has(bus.routeId)) {
    errors.push(`Bus ${bId} references invalid routeId: '${bus.routeId}'`);
  } else {
    busesPerRoute.set(bus.routeId, (busesPerRoute.get(bus.routeId) || 0) + 1);
  }

  if (bus.type in busTypes) {
    busTypes[bus.type]++;
  } else {
    errors.push(`Bus ${bId} has invalid type: '${bus.type}'`);
  }
}

// Summary Output
console.log('\n================ VALIDATION REPORT ================');
console.log(`Total Stops:  ${stops.length}`);
console.log(`Total Routes: ${routes.length} (${routes.length / 2} base routes × 2 directions)`);
console.log(`Total Buses:  ${buses.length}`);
console.log(`Fleet Mix:    NON_AC: ${busTypes.NON_AC} (${Math.round(busTypes.NON_AC / buses.length * 100)}%), AC: ${busTypes.AC} (${Math.round(busTypes.AC / buses.length * 100)}%), EV: ${busTypes.EV} (${Math.round(busTypes.EV / buses.length * 100)}%)`);
console.log(`Errors:       ${errors.length}`);
console.log(`Warnings:     ${warnings.length}`);
console.log('===================================================\n');

if (errors.length > 0) {
  console.error(`❌ Validation FAILED with ${errors.length} error(s):`);
  for (const err of errors.slice(0, 20)) {
    console.error(`  - ${err}`);
  }
  if (errors.length > 20) {
    console.error(`  ... and ${errors.length - 20} more errors`);
  }
  process.exit(1);
}

console.log('✅ ALL VALIDATION CHECKS PASSED SUCCESSFULLY!\n');
process.exit(0);
