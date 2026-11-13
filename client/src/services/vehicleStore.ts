import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Bus, BusLiveState, Route, JourneyFilters } from '../types/transit';
import { normalizeBusType } from '../types/transit';
import { getDistanceMetres, getBearing } from '../utils/geo';

const busMetadata = new Map<string, Bus>();
const busIdByIndex: string[] = [];
const liveBuses = new Map<string, BusLiveState>();
const routeCatalog = new Map<string, Route>();

// Active simulation state for local vehicles along real routes
interface SimVehicle {
  busId: string;
  routeId: string;
  coordIndex: number;
  segmentProgress: number; // 0 to 1 along current segment
  speedMps: number; // metres per second
  heading: number;
  lat: number;
  lng: number;
}
const simVehicles = new Map<string, SimVehicle>();

let mapInstance: MapLibreMap | null = null;
let animationFrameId: number | null = null;
let lastTickTime = performance.now();
let lastSourceUpdateTime = 0;
let trackedBusId: string | null = null;
let targetStopLocation: [number, number] | null = null; // [lng, lat]
let activeFilters: JourneyFilters = {
  ac: false,
  nonAc: false,
  electric: false,
  notCrowded: false,
  within10m: false,
};

// SVG Icons
const SVG_DEFAULT_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
  </filter>
  <g filter="url(#sh)">
    <circle cx="24" cy="24" r="18" fill="#246153" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="24,3 30,11 18,11" fill="#FFFFFF"/>
    <rect x="16" y="14" width="16" height="20" rx="3.5" fill="#FFFFFF"/>
    <rect x="18" y="16" width="12" height="5" rx="1.5" fill="#246153"/>
    <rect x="18" y="23" width="12" height="3" rx="0.5" fill="#246153"/>
    <circle cx="18.5" cy="30" r="1.5" fill="#246153"/>
    <circle cx="27.5" cy="30" r="1.5" fill="#246153"/>
  </g>
</svg>`;

const SVG_AC_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <filter id="sh-ac" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
  </filter>
  <g filter="url(#sh-ac)">
    <circle cx="24" cy="24" r="18" fill="#1D6F60" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="24,3 30,11 18,11" fill="#A7F3D0"/>
    <rect x="16" y="14" width="16" height="20" rx="3.5" fill="#FFFFFF"/>
    <rect x="18" y="16" width="12" height="5" rx="1.5" fill="#1D6F60"/>
    <rect x="18" y="23" width="12" height="3" rx="0.5" fill="#1D6F60"/>
    <circle cx="18.5" cy="30" r="1.5" fill="#1D6F60"/>
    <circle cx="27.5" cy="30" r="1.5" fill="#1D6F60"/>
  </g>
</svg>`;

const SVG_ELECTRIC_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <filter id="sh-el" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35"/>
  </filter>
  <g filter="url(#sh-el)">
    <circle cx="24" cy="24" r="18" fill="#0E5280" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="24,3 30,11 18,11" fill="#BAE6FD"/>
    <rect x="16" y="14" width="16" height="20" rx="3.5" fill="#FFFFFF"/>
    <rect x="18" y="16" width="12" height="5" rx="1.5" fill="#0E5280"/>
    <polygon points="25,22 22,26 24,26 23,29 27,25 25,25" fill="#0E5280"/>
    <circle cx="18.5" cy="30" r="1.5" fill="#0E5280"/>
    <circle cx="27.5" cy="30" r="1.5" fill="#0E5280"/>
  </g>
</svg>`;

const SVG_TRACKED_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
  <filter id="sh-tr" x="-25%" y="-25%" width="150%" height="150%">
    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#F59E0B" flood-opacity="0.6"/>
  </filter>
  <g filter="url(#sh-tr)">
    <circle cx="28" cy="28" r="22" fill="#18202A" stroke="#F59E0B" stroke-width="4"/>
    <polygon points="28,2 35,12 21,12" fill="#F59E0B"/>
    <rect x="19" y="17" width="18" height="23" rx="4" fill="#FFFFFF"/>
    <rect x="21" y="19" width="14" height="6" rx="1.5" fill="#18202A"/>
    <circle cx="22" cy="35" r="1.8" fill="#F59E0B"/>
    <circle cx="32" cy="35" r="1.8" fill="#F59E0B"/>
  </g>
</svg>`;

const SVG_USER_ARROW = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <filter id="sh-usr" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
  </filter>
  <g filter="url(#sh-usr)">
    <circle cx="20" cy="20" r="11" fill="#1A73E8" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="20,2 27,14 20,10 13,14" fill="#1A73E8" stroke="#FFFFFF" stroke-width="1.5"/>
  </g>
</svg>`;

function registerSvgIcon(map: MapLibreMap, name: string, svg: string, size = 48) {
  if (map.hasImage(name)) return;
  const img = new Image(size, size);
  img.onload = () => {
    if (!map.hasImage(name)) {
      map.addImage(name, img, { pixelRatio: 2 });
    }
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

export function setVehicleFilters(filters: JourneyFilters) {
  activeFilters = { ...filters };
}

export function setTrackedBus(busId: string | null, targetStop?: [number, number]) {
  trackedBusId = busId;
  targetStopLocation = targetStop ?? null;
}

export function setBusCatalog(buses: Bus[]) {
  busMetadata.clear();
  busIdByIndex.length = 0;
  for (let i = 0; i < buses.length; i++) {
    const b = buses[i];
    const normalizedBus = { ...b, type: normalizeBusType(b.type) };
    busMetadata.set(b._id, normalizedBus);
    busIdByIndex.push(b._id);
  }
  initializeSimVehiclesIfReady();
}

export function setRoutesCatalog(routes: Route[]) {
  routeCatalog.clear();
  for (const r of routes) {
    routeCatalog.set(r._id, r);
  }
  initializeSimVehiclesIfReady();
}

// Generate active smooth moving fleet along real Bengaluru routes
function initializeSimVehiclesIfReady() {
  if (routeCatalog.size === 0 || busMetadata.size === 0 || simVehicles.size > 0) return;

  const routes = Array.from(routeCatalog.values());
  const buses = Array.from(busMetadata.values());

  // Assign up to 80 buses across routes
  for (let i = 0; i < Math.min(80, buses.length); i++) {
    const bus = buses[i];
    const route = routeCatalog.get(bus.routeId) || routes[i % routes.length];
    if (!route || !route.geometry?.coordinates || route.geometry.coordinates.length < 2) continue;

    const coords = route.geometry.coordinates;
    const startIndex = (i * 3) % (coords.length - 1);
    const p1 = coords[startIndex];
    const p2 = coords[startIndex + 1];

    const heading = getBearing(p1[1], p1[0], p2[1], p2[0]);

    simVehicles.set(bus._id, {
      busId: bus._id,
      routeId: route._id,
      coordIndex: startIndex,
      segmentProgress: (i * 0.25) % 1,
      speedMps: 7 + (i % 5), // ~25 to 40 km/h
      heading,
      lng: p1[0],
      lat: p1[1],
    });
  }
}

// Monotonic sequence updates from server deltas
export function applyDeltaRows(rows: number[][], timestamp: number = Date.now()) {
  for (let i = 0; i < rows.length; i++) {
    const [idx, latInt, lngInt, speedInt, heading, seq] = rows[i];
    const busId = busIdByIndex[idx];
    if (!busId) continue;

    const lat = latInt / 1e5;
    const lng = lngInt / 1e5;
    const speed = speedInt / 10;

    const existing = liveBuses.get(busId);
    if (existing && seq <= existing.seq) continue;

    const prevLat = existing ? existing.targetLat ?? existing.lat : lat;
    const prevLng = existing ? existing.targetLng ?? existing.lng : lng;
    const prevHdg = existing ? existing.targetHeading ?? existing.heading : heading;

    liveBuses.set(busId, {
      busId,
      lat: existing ? existing.interpolatedLat ?? prevLat : lat,
      lng: existing ? existing.interpolatedLng ?? prevLng : lng,
      speed,
      heading,
      seq,
      updatedAt: timestamp,
      prevLat,
      prevLng,
      prevHeading: prevHdg,
      targetLat: lat,
      targetLng: lng,
      targetHeading: heading,
      interpolatedLat: existing ? existing.interpolatedLat ?? prevLat : lat,
      interpolatedLng: existing ? existing.interpolatedLng ?? prevLng : lng,
      interpolatedHeading: heading,
    });
  }
}

export function applySnapshot(buses: any[], timestamp: number = Date.now()) {
  for (const b of buses) {
    const busId = b.busId || b._id;
    if (!busId) continue;

    const lat = b.loc?.coordinates ? b.loc.coordinates[1] : b.lat;
    const lng = b.loc?.coordinates ? b.loc.coordinates[0] : b.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    liveBuses.set(busId, {
      busId,
      lat,
      lng,
      speed: b.speed ?? 25,
      heading: b.heading ?? 0,
      seq: b.seq ?? 1,
      routeId: b.routeId,
      updatedAt: timestamp,
      prevLat: lat,
      prevLng: lng,
      prevHeading: b.heading ?? 0,
      targetLat: lat,
      targetLng: lng,
      targetHeading: b.heading ?? 0,
      interpolatedLat: lat,
      interpolatedLng: lng,
      interpolatedHeading: b.heading ?? 0,
    });
  }
}

// User location update
export function updateUserLocationMarker(lng: number, lat: number, heading = 0) {
  if (!mapInstance) return;
  const source = mapInstance.getSource('user-location') as GeoJSONSource | undefined;
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { heading },
        },
      ],
    });
  }
}

// Selected route line highlight
export function setSelectedRouteLine(
  routeCoords: [number, number][],
  remainingCoords?: [number, number][]
) {
  if (!mapInstance) return;
  const source = mapInstance.getSource('selected-route') as GeoJSONSource | undefined;
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: routeCoords },
          properties: { type: 'main' },
        },
        ...(remainingCoords && remainingCoords.length > 1
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: remainingCoords },
                properties: { type: 'remaining' },
              },
            ]
          : []),
      ],
    });
  }
}

// Set up Map layers and start the 60fps interpolation rAF loop
export function setupVehicleMapLayers(map: MapLibreMap) {
  mapInstance = map;

  // Register all SVG icons
  registerSvgIcon(map, 'bus-icon-default', SVG_DEFAULT_BUS);
  registerSvgIcon(map, 'bus-icon-ac', SVG_AC_BUS);
  registerSvgIcon(map, 'bus-icon-electric', SVG_ELECTRIC_BUS);
  registerSvgIcon(map, 'bus-icon-tracked', SVG_TRACKED_BUS, 56);
  registerSvgIcon(map, 'user-arrow-icon', SVG_USER_ARROW, 40);

  // Selected Route Line Sources
  if (!map.getSource('selected-route')) {
    map.addSource('selected-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  // Selected route casing
  if (!map.getLayer('selected-route-casing')) {
    map.addLayer({
      id: 'selected-route-casing',
      type: 'line',
      source: 'selected-route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 7,
        'line-opacity': 0.9,
      },
    });
  }

  // Selected route main line
  if (!map.getLayer('selected-route-main')) {
    map.addLayer({
      id: 'selected-route-main',
      type: 'line',
      source: 'selected-route',
      filter: ['==', 'type', 'main'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#2F675B', // --primary-600
        'line-width': 4.5,
      },
    });
  }

  // Selected route remaining path to boarding stop (amber dashed)
  if (!map.getLayer('selected-route-remaining')) {
    map.addLayer({
      id: 'selected-route-remaining',
      type: 'line',
      source: 'selected-route',
      filter: ['==', 'type', 'remaining'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#F59E0B', // --amber-500
        'line-width': 4,
        'line-dasharray': [2, 2],
      },
    });
  }

  // Bus sources
  if (!map.getSource('buses')) {
    map.addSource('buses', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getSource('tracked-bus')) {
    map.addSource('tracked-bus', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getSource('tracked-bus-pulse')) {
    map.addSource('tracked-bus-pulse', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  // Soft colored pulse layer when selected bus approaches stop
  if (!map.getLayer('tracked-bus-pulse-ring')) {
    map.addLayer({
      id: 'tracked-bus-pulse-ring',
      type: 'circle',
      source: 'tracked-bus-pulse',
      paint: {
        'circle-radius': 16,
        'circle-color': '#F59E0B',
        'circle-opacity': 0.5,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-opacity': 0.6,
      },
    });
  }

  // Normal buses symbol layer with SVG icon
  if (!map.getLayer('buses-icon-layer')) {
    map.addLayer({
      id: 'buses-icon-layer',
      type: 'symbol',
      source: 'buses',
      layout: {
        'icon-image': ['get', 'iconName'],
        'icon-size': 0.72,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'routeNo'],
        'text-size': 11,
        'text-offset': [0, 1.3],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': '#0E1116',
        'text-halo-color': '#FFFFFF',
        'text-halo-width': 2,
      },
    });
  }

  // Tracked bus symbol layer
  if (!map.getLayer('tracked-bus-icon-layer')) {
    map.addLayer({
      id: 'tracked-bus-icon-layer',
      type: 'symbol',
      source: 'tracked-bus',
      layout: {
        'icon-image': 'bus-icon-tracked',
        'icon-size': 0.9,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'label'],
        'text-size': 12,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#0E1116',
        'text-halo-color': '#F59E0B',
        'text-halo-width': 2,
      },
    });
  }

  // User location sources & layers
  if (!map.getSource('user-location')) {
    map.addSource('user-location', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  // Accuracy circle
  if (!map.getLayer('user-accuracy-ring')) {
    map.addLayer({
      id: 'user-accuracy-ring',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': 30,
        'circle-color': '#1A73E8',
        'circle-opacity': 0.16,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#1A73E8',
        'circle-stroke-opacity': 0.35,
      },
    });
  }

  // Google Maps-style directional arrow
  if (!map.getLayer('user-arrow-marker')) {
    map.addLayer({
      id: 'user-arrow-marker',
      type: 'symbol',
      source: 'user-location',
      layout: {
        'icon-image': 'user-arrow-icon',
        'icon-size': 0.75,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
    });
  }

  startRafLoop();
}

function startRafLoop() {
  if (animationFrameId !== null) return;
  lastTickTime = performance.now();

  const loop = (currentTime: number) => {
    animationFrameId = requestAnimationFrame(loop);

    if (!mapInstance || !mapInstance.getSource('buses')) return;

    const dt = Math.min(0.1, (currentTime - lastTickTime) / 1000);
    lastTickTime = currentTime;

    // Advance local simulated vehicles along real route geometries
    for (const [busId, sim] of simVehicles.entries()) {
      const route = routeCatalog.get(sim.routeId);
      if (!route || !route.geometry?.coordinates || route.geometry.coordinates.length < 2) continue;

      const coords = route.geometry.coordinates;
      const p1 = coords[sim.coordIndex];
      const p2 = coords[(sim.coordIndex + 1) % coords.length];

      const segmentDist = getDistanceMetres(p1[1], p1[0], p2[1], p2[0]);
      const progressDelta = segmentDist > 0 ? (sim.speedMps * dt) / segmentDist : 1;

      sim.segmentProgress += progressDelta;

      if (sim.segmentProgress >= 1) {
        sim.segmentProgress = 0;
        sim.coordIndex = (sim.coordIndex + 1) % (coords.length - 1);
      }

      const currentP1 = coords[sim.coordIndex];
      const currentP2 = coords[(sim.coordIndex + 1) % coords.length];

      sim.lng = currentP1[0] + (currentP2[0] - currentP1[0]) * sim.segmentProgress;
      sim.lat = currentP1[1] + (currentP2[1] - currentP1[1]) * sim.segmentProgress;
      sim.heading = getBearing(currentP1[1], currentP1[0], currentP2[1], currentP2[0]);

      // If no live server delta exists for this bus, update liveBuses map
      if (!liveBuses.has(busId)) {
        liveBuses.set(busId, {
          busId,
          lat: sim.lat,
          lng: sim.lng,
          speed: Math.round(sim.speedMps * 3.6),
          heading: sim.heading,
          seq: 1,
          routeId: route._id,
          updatedAt: Date.now(),
          targetLat: sim.lat,
          targetLng: sim.lng,
          interpolatedLat: sim.lat,
          interpolatedLng: sim.lng,
          interpolatedHeading: sim.heading,
        });
      }
    }

    // Build features respecting active filters
    const normalFeatures: any[] = [];
    let trackedFeature: any = null;
    let trackedBusPos: [number, number] | null = null;

    for (const bus of liveBuses.values()) {
      const meta = busMetadata.get(bus.busId);
      const busType = normalizeBusType(meta?.type);

      // Apply Filters: Remove buses from the map that don't match
      if (activeFilters.ac && busType !== 'AC') continue;
      if (activeFilters.nonAc && busType !== 'NonAC') continue;
      if (activeFilters.electric && busType !== 'Electric') continue;

      const lat = bus.interpolatedLat ?? bus.lat;
      const lng = bus.interpolatedLng ?? bus.lng;
      const heading = bus.interpolatedHeading ?? bus.heading;

      let iconName = 'bus-icon-default';
      if (busType === 'AC') iconName = 'bus-icon-ac';
      if (busType === 'Electric') iconName = 'bus-icon-electric';

      const routeNo = meta?.routeId?.split('-')[0] || '';

      const feature = {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat],
        },
        properties: {
          busId: bus.busId,
          routeNo,
          type: busType,
          iconName,
          heading,
          speed: bus.speed,
        },
      };

      if (bus.busId === trackedBusId) {
        trackedFeature = {
          ...feature,
          properties: {
            ...feature.properties,
            label: `★ ${routeNo}`,
          },
        };
        trackedBusPos = [lng, lat];
      } else {
        normalFeatures.push(feature);
      }
    }

    // Update normal buses data
    if (currentTime - lastSourceUpdateTime > 33) {
      const busesSource = mapInstance.getSource('buses') as GeoJSONSource | undefined;
      if (busesSource) {
        busesSource.setData({
          type: 'FeatureCollection',
          features: normalFeatures,
        });
      }
      lastSourceUpdateTime = currentTime;
    }

    // Update tracked bus layer
    const trackedSource = mapInstance.getSource('tracked-bus') as GeoJSONSource | undefined;
    if (trackedSource) {
      trackedSource.setData({
        type: 'FeatureCollection',
        features: trackedFeature ? [trackedFeature] : [],
      });
    }

    // Pulse animation when selected bus is near the bus stop
    const pulseSource = mapInstance.getSource('tracked-bus-pulse') as GeoJSONSource | undefined;
    if (pulseSource) {
      let isNearStop = false;
      if (trackedBusPos && targetStopLocation) {
        const distToStop = getDistanceMetres(
          trackedBusPos[1],
          trackedBusPos[0],
          targetStopLocation[1],
          targetStopLocation[0]
        );
        isNearStop = distToStop < 600; // within 600m
      }

      if (isNearStop && trackedBusPos) {
        pulseSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: trackedBusPos },
              properties: {},
            },
          ],
        });

        // Compute animated pulse properties
        const cycle = (currentTime % 1400) / 1400; // 0 to 1 over 1.4s
        const radius = 14 + cycle * 26; // 14px to 40px
        const opacity = 0.8 * (1 - cycle);

        if (mapInstance.getLayer('tracked-bus-pulse-ring')) {
          mapInstance.setPaintProperty('tracked-bus-pulse-ring', 'circle-radius', radius);
          mapInstance.setPaintProperty('tracked-bus-pulse-ring', 'circle-opacity', opacity);
        }
      } else {
        pulseSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  };

  animationFrameId = requestAnimationFrame(loop);
}

export function teardownVehicleStore() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  mapInstance = null;
}
