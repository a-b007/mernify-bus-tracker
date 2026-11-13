import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Bus, BusLiveState } from '../types/transit';

const busMetadata = new Map<string, Bus>();
const busIdByIndex: string[] = [];
const liveBuses = new Map<string, BusLiveState>();

let mapInstance: MapLibreMap | null = null;
let animationFrameId: number | null = null;
let lastSourceUpdateTime = 0;
let trackedBusId: string | null = null;

export function setTrackedBus(busId: string | null) {
  trackedBusId = busId;
}

export function setBusCatalog(buses: Bus[]) {
  busMetadata.clear();
  busIdByIndex.length = 0;
  for (let i = 0; i < buses.length; i++) {
    const b = buses[i];
    busMetadata.set(b._id, b);
    busIdByIndex.push(b._id);
  }
}

export function getBusMeta(busId: string): Bus | undefined {
  return busMetadata.get(busId);
}

export function getLiveBusState(busId: string): BusLiveState | undefined {
  return liveBuses.get(busId);
}

export function getAllLiveBuses(): BusLiveState[] {
  return Array.from(liveBuses.values());
}

// Shortest angle heading interpolation
function interpolateHeading(from: number, to: number, t: number): number {
  let diff = (to - from) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (from + diff * t + 360) % 360;
}

// Monotonic sequence update
export function applyDeltaRows(rows: number[][], timestamp: number = Date.now()) {
  for (let i = 0; i < rows.length; i++) {
    const [idx, latInt, lngInt, speedInt, heading, seq] = rows[i];
    const busId = busIdByIndex[idx];
    if (!busId) continue;

    const lat = latInt / 1e5;
    const lng = lngInt / 1e5;
    const speed = speedInt / 10;

    const existing = liveBuses.get(busId);
    if (existing && seq <= existing.seq) {
      // Drop stale or out-of-order delta
      continue;
    }

    const prevLat = existing ? existing.targetLat ?? existing.lat : lat;
    const prevLng = existing ? existing.targetLng ?? existing.lng : lng;
    const prevHdg = existing ? existing.targetHeading ?? existing.heading : heading;

    liveBuses.set(busId, {
      busId,
      lat: existing ? existing.interpolatedLat ?? prevLat : lat,
      lng: existing ? existing.interpolatedLng ?? prevLng : lng,
      speed,
      heading: existing ? existing.interpolatedHeading ?? prevHdg : heading,
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
      interpolatedHeading: existing ? existing.interpolatedHeading ?? prevHdg : heading,
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

    const existing = liveBuses.get(busId);
    if (existing && b.seq && b.seq <= existing.seq) continue;

    liveBuses.set(busId, {
      busId,
      lat,
      lng,
      speed: b.speed ?? 20,
      heading: b.heading ?? 0,
      seq: b.seq ?? 1,
      routeId: b.routeId,
      progressM: b.progressM,
      nextStopId: b.nextStopId,
      occ: b.occ,
      delayS: b.delayS,
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

// Set up Map layers and start the 60fps interpolation rAF loop
export function setupVehicleMapLayers(map: MapLibreMap) {
  mapInstance = map;

  // Add source for buses
  if (!map.getSource('buses')) {
    map.addSource('buses', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  // Add source for tracked bus
  if (!map.getSource('tracked-bus')) {
    map.addSource('tracked-bus', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  // Add layer for normal buses: 14px primary-600 dot with white ring
  if (!map.getLayer('buses-halo')) {
    map.addLayer({
      id: 'buses-halo',
      type: 'circle',
      source: 'buses',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          3,
          13,
          5,
          15,
          8,
        ],
        'circle-color': '#FFFFFF',
        'circle-opacity': 0.9,
      },
    });
  }

  if (!map.getLayer('buses-circle')) {
    map.addLayer({
      id: 'buses-circle',
      type: 'circle',
      source: 'buses',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          2,
          13,
          4,
          15,
          7,
        ],
        'circle-color': '#45796D', // --primary-600
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#FFFFFF',
      },
    });
  }

  // Tracked bus layer: 20px ink fill, white ring, amber halo
  if (!map.getLayer('tracked-bus-halo')) {
    map.addLayer({
      id: 'tracked-bus-halo',
      type: 'circle',
      source: 'tracked-bus',
      paint: {
        'circle-radius': 14,
        'circle-color': '#D98E2B', // --amber-500
        'circle-opacity': 0.4,
      },
    });
  }

  if (!map.getLayer('tracked-bus-circle')) {
    map.addLayer({
      id: 'tracked-bus-circle',
      type: 'circle',
      source: 'tracked-bus',
      paint: {
        'circle-radius': 10,
        'circle-color': '#1E2229', // ink
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#FFFFFF',
      },
    });
  }

  startRafLoop();
}

function startRafLoop() {
  if (animationFrameId !== null) return;

  const loop = (currentTime: number) => {
    animationFrameId = requestAnimationFrame(loop);

    if (!mapInstance || !mapInstance.getSource('buses')) return;

    const now = Date.now();
    // Render buses ~2s in the past and interpolate across a 2000ms window
    const renderTime = now - 2000;

    const normalFeatures: any[] = [];
    let trackedFeature: any = null;

    for (const bus of liveBuses.values()) {
      if (!bus.targetLat || !bus.targetLng) continue;

      // Elapsed time since last update
      const elapsed = Math.max(0, renderTime - (bus.updatedAt - 2000));
      const t = Math.min(1, Math.max(0, elapsed / 2000));

      const lat = (bus.prevLat ?? bus.lat) + ((bus.targetLat ?? bus.lat) - (bus.prevLat ?? bus.lat)) * t;
      const lng = (bus.prevLng ?? bus.lng) + ((bus.targetLng ?? bus.lng) - (bus.prevLng ?? bus.lng)) * t;
      const heading = interpolateHeading(bus.prevHeading ?? bus.heading, bus.targetHeading ?? bus.heading, t);

      bus.interpolatedLat = lat;
      bus.interpolatedLng = lng;
      bus.interpolatedHeading = heading;

      const meta = busMetadata.get(bus.busId);
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          busId: bus.busId,
          routeNo: meta?.routeId?.split('-')[0] || '',
          type: meta?.type || 'NonAC',
          heading,
          speed: bus.speed,
        },
      };

      if (bus.busId === trackedBusId) {
        trackedFeature = feature;
      } else {
        normalFeatures.push(feature);
      }
    }

    // Throttle GeoJSON update for normal buses to 10-15 fps to stay buttery smooth
    if (currentTime - lastSourceUpdateTime > 66) {
      const busesSource = mapInstance.getSource('buses') as GeoJSONSource | undefined;
      if (busesSource) {
        busesSource.setData({
          type: 'FeatureCollection',
          features: normalFeatures,
        });
      }
      lastSourceUpdateTime = currentTime;
    }

    // Tracked bus updates at full 60fps
    const trackedSource = mapInstance.getSource('tracked-bus') as GeoJSONSource | undefined;
    if (trackedSource) {
      trackedSource.setData({
        type: 'FeatureCollection',
        features: trackedFeature ? [trackedFeature] : [],
      });
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
