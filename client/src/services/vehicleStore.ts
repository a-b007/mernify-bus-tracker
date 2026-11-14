import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Bus, BusLiveState, Route, Stop, JourneyFilters } from '../types/transit';
import { normalizeBusType } from '../types/transit';
import { getDistanceMetres, getBearing } from '../utils/geo';

const busMetadata = new Map<string, Bus>();
const busIdByIndex: string[] = [];
const liveBuses = new Map<string, BusLiveState>();
const routeCatalog = new Map<string, Route>();
let stopsData: Stop[] = [];

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

let onBusClickCallback: ((busId: string) => void) | null = null;
export function setOnBusClickListener(listener: ((busId: string) => void) | null) {
  onBusClickCallback = listener;
}

let mapInstance: MapLibreMap | null = null;
let animationFrameId: number | null = null;
let lastTickTime = performance.now();
let lastSourceUpdateTime = 0;
let trackedBusId: string | null = null;
let targetStopLocation: [number, number] | null = null; // [lng, lat]
let trackedRouteId: string | null = null;
let trackedBoardingStopId: string | null = null;
let trackedDestStopId: string | null = null;
let activeFilters: JourneyFilters = {
  ac: false,
  nonAc: false,
  electric: false,
  notCrowded: false,
  within10m: false,
};

// SVG Icons — palette from DESIGN.md: slate = non-AC, teal = AC, sage = electric, saffron = tracked
const SVG_DEFAULT_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="bus-sh-def" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#1E2229" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#bus-sh-def)">
    <!-- Direction chevron -->
    <polygon points="26,1 32,8 26,6 20,8" fill="#6B7887" stroke="#1E2229" stroke-width="1" stroke-linejoin="round"/>
    <!-- Side wing mirrors -->
    <rect x="14" y="13" width="2.5" height="5" rx="1" fill="#6B7887" stroke="#1E2229" stroke-width="1"/>
    <rect x="35.5" y="13" width="2.5" height="5" rx="1" fill="#6B7887" stroke="#1E2229" stroke-width="1"/>
    <!-- Main Bus Body (Vivid Yellow Non-AC) -->
    <rect x="16.5" y="9" width="19" height="34" rx="4.5" fill="#6B7887" stroke="#1E2229" stroke-width="2"/>
    <!-- Windshield -->
    <rect x="18.5" y="12" width="15" height="6" rx="1.5" fill="#1E2229"/>
    <line x1="20" y1="13.5" x2="25" y2="13.5" stroke="#C5D6C9" stroke-width="1.2" stroke-linecap="round"/>
    <!-- Headlights -->
    <rect x="17.5" y="9.5" width="3" height="1.5" rx="0.5" fill="#F6E6C8"/>
    <rect x="31.5" y="9.5" width="3" height="1.5" rx="0.5" fill="#F6E6C8"/>
    <!-- Roof Details -->
    <rect x="20" y="21" width="12" height="2" rx="0.8" fill="#E9EDE3" opacity="0.9"/>
    <rect x="20" y="25" width="12" height="2" rx="0.8" fill="#E9EDE3" opacity="0.9"/>
    <rect x="20" y="29" width="12" height="2" rx="0.8" fill="#E9EDE3" opacity="0.9"/>
    <!-- Rear Window & Tail lights -->
    <rect x="19" y="38" width="14" height="2" rx="0.8" fill="#1E2229"/>
    <rect x="17.5" y="41.5" width="3" height="1.5" rx="0.5" fill="#B4493B"/>
    <rect x="31.5" y="41.5" width="3" height="1.5" rx="0.5" fill="#B4493B"/>
  </g>
</svg>`;

const SVG_AC_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="bus-sh-ac" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#1E2229" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#bus-sh-ac)">
    <!-- Direction chevron -->
    <polygon points="26,1 32,8 26,6 20,8" fill="#C5D6C9" stroke="#1E2229" stroke-width="1" stroke-linejoin="round"/>
    <!-- Side wing mirrors -->
    <rect x="14" y="13" width="2.5" height="5" rx="1" fill="#45796D" stroke="#1E2229" stroke-width="1"/>
    <rect x="35.5" y="13" width="2.5" height="5" rx="1" fill="#45796D" stroke="#1E2229" stroke-width="1"/>
    <!-- Main Bus Body (Vivid Teal AC) -->
    <rect x="16.5" y="9" width="19" height="34" rx="4.5" fill="#45796D" stroke="#1E2229" stroke-width="2"/>
    <!-- Windshield -->
    <rect x="18.5" y="12" width="15" height="6" rx="1.5" fill="#1E2229"/>
    <line x1="20" y1="13.5" x2="25" y2="13.5" stroke="#C5D6C9" stroke-width="1.2" stroke-linecap="round"/>
    <!-- Headlights -->
    <rect x="17.5" y="9.5" width="3" height="1.5" rx="0.5" fill="#F6E6C8"/>
    <rect x="31.5" y="9.5" width="3" height="1.5" rx="0.5" fill="#F6E6C8"/>
    <!-- AC Unit on Roof -->
    <rect x="19.5" y="21" width="13" height="8" rx="2" fill="#2F6358" stroke="#1E2229" stroke-width="1"/>
    <circle cx="23" cy="25" r="1.5" fill="#E9EDE3"/>
    <circle cx="29" cy="25" r="1.5" fill="#E9EDE3"/>
    <!-- Rear Window & Tail lights -->
    <rect x="19" y="38" width="14" height="2" rx="0.8" fill="#1E2229"/>
    <rect x="17.5" y="41.5" width="3" height="1.5" rx="0.5" fill="#B4493B"/>
    <rect x="31.5" y="41.5" width="3" height="1.5" rx="0.5" fill="#B4493B"/>
  </g>
</svg>`;

const SVG_ELECTRIC_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="bus-sh-el" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#1E2229" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#bus-sh-el)">
    <!-- Direction chevron -->
    <polygon points="26,1 32,8 26,6 20,8" fill="#E9EDE3" stroke="#1E2229" stroke-width="1" stroke-linejoin="round"/>
    <!-- Side wing mirrors -->
    <rect x="14" y="13" width="2.5" height="5" rx="1" fill="#80A48D" stroke="#1E2229" stroke-width="1"/>
    <rect x="35.5" y="13" width="2.5" height="5" rx="1" fill="#80A48D" stroke="#1E2229" stroke-width="1"/>
    <!-- Main Bus Body (Vivid Blue Electric) -->
    <rect x="16.5" y="9" width="19" height="34" rx="4.5" fill="#80A48D" stroke="#1E2229" stroke-width="2"/>
    <!-- Windshield -->
    <rect x="18.5" y="12" width="15" height="6" rx="1.5" fill="#1E2229"/>
    <line x1="20" y1="13.5" x2="25" y2="13.5" stroke="#E9EDE3" stroke-width="1.2" stroke-linecap="round"/>
    <!-- Headlights -->
    <rect x="17.5" y="9.5" width="3" height="1.5" rx="0.5" fill="#F6E6C8"/>
    <rect x="31.5" y="9.5" width="3" height="1.5" rx="0.5" fill="#F6E6C8"/>
    <!-- Battery / Electric Bolt Symbol -->
    <polygon points="27,20 23,26 26,26 24.5,31 29,24 26,24" fill="#F6E6C8" stroke="#1E2229" stroke-width="0.8"/>
    <!-- Rear Window & Tail lights -->
    <rect x="19" y="38" width="14" height="2" rx="0.8" fill="#1E2229"/>
    <rect x="17.5" y="41.5" width="3" height="1.5" rx="0.5" fill="#B4493B"/>
    <rect x="31.5" y="41.5" width="3" height="1.5" rx="0.5" fill="#B4493B"/>
  </g>
</svg>`;

const SVG_TRACKED_BUS = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <filter id="bus-sh-tr" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#D98E2B" flood-opacity="0.95"/>
    </filter>
  </defs>
  <g filter="url(#bus-sh-tr)">
    <!-- Outer Cyan Glow Halo -->
    <rect x="17.5" y="6.5" width="29" height="51" rx="8" fill="none" stroke="#D98E2B" stroke-width="3" opacity="0.95"/>
    <!-- Direction Chevron -->
    <polygon points="32,0 42,10 32,7.5 22,10" fill="#D98E2B" stroke="#1E2229" stroke-width="1.5" stroke-linejoin="round"/>
    <!-- Side Mirrors -->
    <rect x="15.5" y="16" width="3.5" height="7" rx="1.5" fill="#D98E2B" stroke="#1E2229" stroke-width="1.2"/>
    <rect x="45" y="16" width="3.5" height="7" rx="1.5" fill="#D98E2B" stroke="#1E2229" stroke-width="1.2"/>
    <!-- Main Body: High contrast Dark Slate with glowing cyan accents -->
    <rect x="19.5" y="8.5" width="25" height="47" rx="6" fill="#1E2229" stroke="#D98E2B" stroke-width="2.5"/>
    <!-- Windshield -->
    <rect x="22" y="12.5" width="20" height="9" rx="2.5" fill="#D98E2B"/>
    <line x1="24" y1="15.5" x2="31" y2="15.5" stroke="#FAFBF7" stroke-width="1.5" stroke-linecap="round"/>
    <!-- Center Strobe/Beacon -->
    <circle cx="32" cy="32" r="5" fill="#D98E2B"/>
    <circle cx="32" cy="32" r="2.5" fill="#FAFBF7"/>
    <!-- Roof Ribs -->
    <rect x="23" y="24" width="18" height="2" rx="0.8" fill="#D98E2B" opacity="0.8"/>
    <rect x="23" y="40" width="18" height="2" rx="0.8" fill="#D98E2B" opacity="0.8"/>
    <!-- Tail lights -->
    <rect x="22" y="51" width="4.5" height="2" rx="0.8" fill="#B4493B"/>
    <rect x="37.5" y="51" width="4.5" height="2" rx="0.8" fill="#B4493B"/>
  </g>
</svg>`;

// Red Stop Location Pin matching user's uploaded marker design
const SVG_RED_PIN = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58">
  <defs>
    <filter id="pin-sh" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <g filter="url(#pin-sh)">
    <path d="M24 0C10.745 0 0 10.745 0 24c0 16.5 24 34 24 34s24-17.5 24-34C48 10.745 37.255 0 24 0z" fill="#1E2229"/>
    <circle cx="24" cy="22" r="9.5" fill="#FFFFFF"/>
  </g>
</svg>`;

const SVG_STOP_MARKER = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <defs>
    <filter id="stop-sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <g filter="url(#stop-sh)">
    <circle cx="18" cy="18" r="15" fill="#45796D" stroke="#FFFFFF" stroke-width="2.5"/>
    <!-- White bus silhouette inside -->
    <rect x="11.5" y="10.5" width="13" height="13" rx="2.5" fill="#FFFFFF"/>
    <rect x="13" y="12" width="10" height="4" rx="1" fill="#45796D"/>
    <circle cx="14" cy="21" r="1.3" fill="#45796D"/>
    <circle cx="22" cy="21" r="1.3" fill="#45796D"/>
    <circle cx="14" cy="17.5" r="0.9" fill="#45796D"/>
    <circle cx="22" cy="17.5" r="0.9" fill="#45796D"/>
  </g>
</svg>`;

const SVG_USER_ARROW = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <filter id="sh-usr" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
  </filter>
  <g filter="url(#sh-usr)">
    <circle cx="20" cy="20" r="11" fill="#2D6CDF" stroke="#FFFFFF" stroke-width="3"/>
    <polygon points="20,2 27,14 20,10 13,14" fill="#2D6CDF" stroke="#FFFFFF" stroke-width="1.5"/>
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

export function calculateBMTCFare(
  boardingStopCoords: [number, number],
  destCoords: [number, number],
  busType: 'AC' | 'NonAC' | 'Electric'
): { fare: number; distanceKm: number } {
  const distM = getDistanceMetres(
    boardingStopCoords[1],
    boardingStopCoords[0],
    destCoords[1],
    destCoords[0]
  );
  const roadDistKm = Math.max(1, Math.round((distM * 1.25) / 100) / 10);

  let fare = 15;
  if (busType === 'AC') {
    if (roadDistKm <= 2) fare = 20;
    else if (roadDistKm <= 5) fare = 30;
    else if (roadDistKm <= 10) fare = 45;
    else if (roadDistKm <= 15) fare = 60;
    else if (roadDistKm <= 20) fare = 75;
    else if (roadDistKm <= 30) fare = 90;
    else fare = 110;
  } else if (busType === 'Electric') {
    if (roadDistKm <= 2) fare = 10;
    else if (roadDistKm <= 5) fare = 15;
    else if (roadDistKm <= 10) fare = 20;
    else if (roadDistKm <= 15) fare = 25;
    else if (roadDistKm <= 20) fare = 30;
    else fare = 35;
  } else {
    // Non-AC Ordinary
    if (roadDistKm <= 2) fare = 5;
    else if (roadDistKm <= 5) fare = 10;
    else if (roadDistKm <= 10) fare = 15;
    else if (roadDistKm <= 15) fare = 20;
    else if (roadDistKm <= 20) fare = 25;
    else if (roadDistKm <= 30) fare = 30;
    else fare = 35;
  }

  return { fare, distanceKm: roadDistKm };
}

export function setVehicleFilters(filters: JourneyFilters) {
  activeFilters = { ...filters };
}

export function setTrackedBus(busId: string | null, targetStop?: [number, number]) {
  trackedBusId = busId;
  targetStopLocation = targetStop ?? null;
}

export function setTrackedRouteContext(
  routeId: string | null,
  boardingStopId?: string | null,
  destStopId?: string | null
) {
  trackedRouteId = routeId;
  trackedBoardingStopId = boardingStopId ?? null;
  trackedDestStopId = destStopId ?? null;
}

let pinnedBoardingStop: Stop | null = null;
let pinnedDestStop: Stop | null = null;

export function setPinnedStops(boarding: Stop | null, dest: Stop | null) {
  pinnedBoardingStop = boarding;
  pinnedDestStop = dest;
  if (!mapInstance) return;
  const source = mapInstance.getSource('pinned-stops') as GeoJSONSource | undefined;
  if (!source) return;

  const features: any[] = [];
  if (boarding?.loc?.coordinates) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: boarding.loc.coordinates },
      properties: {
        id: 'boarding',
        type: 'boarding',
        title: 'Boarding: ' + boarding.name,
      },
    });
  }
  if (dest?.loc?.coordinates) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: dest.loc.coordinates },
      properties: {
        id: 'destination',
        type: 'destination',
        title: 'Destination: ' + dest.name,
      },
    });
  }

  source.setData({
    type: 'FeatureCollection',
    features,
  });
}

export function recenterOnBus(busId: string, zoom = 16) {
  if (!mapInstance) return;
  const sim = simVehicles.get(busId);
  const live = liveBuses.get(busId);
  const lng = sim?.lng ?? live?.interpolatedLng ?? live?.lng;
  const lat = sim?.lat ?? live?.interpolatedLat ?? live?.lat;
  if (lng !== undefined && lat !== undefined) {
    mapInstance.flyTo({
      center: [lng, lat],
      zoom,
      duration: 600,
    });
  }
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

export interface LiveEtaResult {
  etaSeconds: number;
  etaMinutes: number;
  distanceM: number;
  stopsAway: number;
  speedKmh: number;
  status: 'scheduled' | 'approaching' | 'arriving' | 'arrived' | 'departed';
  isDeparted?: boolean;
}

// Map of busId -> Map<stopId, boolean>
// boolean is TRUE when the bus is approaching/upcoming for that stop;
// once the bus reaches the bus stop, set the boolean variable to FALSE!
const busStopApproachingMap = new Map<string, Map<string, boolean>>();

export function isStopUpcoming(busId: string, stopId: string): boolean {
  const stopMap = busStopApproachingMap.get(busId);
  if (!stopMap) return true;
  const isUpcoming = stopMap.get(stopId);
  return isUpcoming !== undefined ? isUpcoming : true;
}

export function getBusStopStates(busId: string): Map<string, boolean> | undefined {
  return busStopApproachingMap.get(busId);
}

const routeDistanceCache = new Map<string, number[]>();

function getRouteDistances(routeId: string, coords: [number, number][]): number[] {
  const cached = routeDistanceCache.get(routeId);
  if (cached && cached.length === coords.length) return cached;
  const dists = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    const d = getDistanceMetres(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
    dists.push(dists[i] + d);
  }
  routeDistanceCache.set(routeId, dists);
  return dists;
}

export function getLiveBus(busId: string): BusLiveState | undefined {
  return liveBuses.get(busId);
}

export function getAllLiveBuses(): BusLiveState[] {
  return Array.from(liveBuses.values());
}

export function calculateBusToStopEta(
  busLat: number,
  busLng: number,
  busSpeedKmh: number,
  stopLat: number,
  stopLng: number
): LiveEtaResult {
  const directDistM = getDistanceMetres(busLat, busLng, stopLat, stopLng);
  // Real road path factor in Bengaluru city grid
  const roadDistM = Math.max(10, directDistM * 1.25);
  // City bus speed in m/s (min 3.5 m/s, avg 5.5 m/s = ~20 km/h)
  const speedMps = busSpeedKmh > 3 ? Math.max(3.5, Math.min(12, busSpeedKmh * (1000 / 3600))) : 5.5;
  const etaSeconds = Math.round(roadDistM / speedMps);
  const etaMinutes = Math.max(1, Math.ceil(etaSeconds / 60));
  const stopsAway = Math.max(1, Math.round(roadDistM / 700));

  let status: LiveEtaResult['status'] = 'scheduled';
  if (roadDistM < 60) {
    status = 'arrived';
  } else if (roadDistM < 250 || etaSeconds < 60) {
    status = 'arriving';
  } else if (etaSeconds <= 180) {
    status = 'approaching';
  }

  return {
    etaSeconds: roadDistM < 60 ? 0 : etaSeconds,
    etaMinutes: roadDistM < 60 ? 0 : etaMinutes,
    distanceM: Math.round(roadDistM),
    stopsAway,
    speedKmh: Math.round(busSpeedKmh || 25),
    status,
    isDeparted: false,
  };
}

export function getBusLiveEta(
  busId: string,
  stopCoords?: [number, number],
  stopId?: string
): LiveEtaResult | null {
  const bus = liveBuses.get(busId);
  if (!bus || !stopCoords) return null;

  // Once a bus reaches the bus stop, boolean is set to false:
  // If stopId is provided and the stop boolean is false, it has departed!
  if (stopId && !isStopUpcoming(busId, stopId)) {
    return {
      etaSeconds: 0,
      etaMinutes: 0,
      distanceM: 0,
      stopsAway: 0,
      speedKmh: Math.round(bus.speed || 25),
      status: 'departed',
      isDeparted: true,
    };
  }

  // If bus is simulated along a route and we have the target stop offset along that route
  const sim = simVehicles.get(busId);
  if (sim && stopId) {
    const route = routeCatalog.get(sim.routeId);
    const targetStop = route?.stops?.find((s) => s.stopId === stopId);
    if (targetStop && route?.geometry?.coordinates && route.geometry.coordinates.length >= 2) {
      const cumDists = getRouteDistances(route._id, route.geometry.coordinates);
      const coords = route.geometry.coordinates;
      const safeIdx = Math.min(sim.coordIndex, coords.length - 2);
      const p1 = coords[safeIdx];
      const p2 = coords[safeIdx + 1];
      const segDist = getDistanceMetres(p1[1], p1[0], p2[1], p2[0]);
      const currentRouteDistM = (cumDists[safeIdx] || 0) + segDist * sim.segmentProgress;

      const forwardDistM = (targetStop.offsetM || 0) - currentRouteDistM;
      if (forwardDistM <= -30) {
        // Bus has already passed this stop! Set boolean to false and mark departed
        const stopMap = busStopApproachingMap.get(busId);
        if (stopMap) stopMap.set(stopId, false);
        return {
          etaSeconds: 0,
          etaMinutes: 0,
          distanceM: 0,
          stopsAway: 0,
          speedKmh: Math.round(bus.speed || 25),
          status: 'departed',
          isDeparted: true,
        };
      }

      const roadDistM = Math.max(10, forwardDistM);
      const speedMps = sim.speedMps > 3 ? sim.speedMps : 6;
      const etaSeconds = Math.round(roadDistM / speedMps);
      const etaMinutes = Math.max(1, Math.ceil(etaSeconds / 60));
      const stopsAway = Math.max(1, Math.round(roadDistM / 750));

      let status: LiveEtaResult['status'] = 'scheduled';
      if (roadDistM < 60) status = 'arrived';
      else if (roadDistM < 250 || etaSeconds < 60) status = 'arriving';
      else if (etaSeconds <= 180) status = 'approaching';

      return {
        etaSeconds,
        etaMinutes,
        distanceM: Math.round(roadDistM),
        stopsAway,
        speedKmh: Math.round(sim.speedMps * 3.6),
        status,
        isDeparted: false,
      };
    }
  }

  const busLat = bus.interpolatedLat ?? bus.lat;
  const busLng = bus.interpolatedLng ?? bus.lng;
  return calculateBusToStopEta(busLat, busLng, bus.speed, stopCoords[1], stopCoords[0]);
}

export function setStopsCatalog(stops: Stop[]) {
  stopsData = stops;
  if (mapInstance) {
    updateStopsSource();
  }
}

function updateStopsSource() {
  if (!mapInstance) return;
  const source = mapInstance.getSource('bus-stops') as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: stopsData.map((s) => ({
      type: 'Feature',
      geometry: s.loc,
      properties: {
        id: s._id,
        name: s.name,
      },
    })),
  });
}

// Generate active smooth moving fleet along real Bengaluru routes
function initializeSimVehiclesIfReady() {
  if (routeCatalog.size === 0 || busMetadata.size === 0 || simVehicles.size > 0) return;

  const routes = Array.from(routeCatalog.values());
  const buses = Array.from(busMetadata.values());

  // Assign all buses across routes with distributed positions
  for (let i = 0; i < buses.length; i++) {
    const bus = buses[i];
    const route = routeCatalog.get(bus.routeId) || routes[i % routes.length];
    if (!route || !route.geometry?.coordinates || route.geometry.coordinates.length < 2) continue;

    const coords = route.geometry.coordinates;
    const startIndex = (i * 2) % (coords.length - 1);
    const p1 = coords[startIndex];
    const p2 = coords[startIndex + 1];

    const heading = getBearing(p1[1], p1[0], p2[1], p2[0]);

    simVehicles.set(bus._id, {
      busId: bus._id,
      routeId: route._id,
      coordIndex: startIndex,
      segmentProgress: ((i * 3) % 10) / 10,
      speedMps: 7 + (i % 5), // ~25 to 40 km/h
      heading,
      lng: p1[0],
      lat: p1[1],
    });

    // Initialize individual boolean variables for each stop in that bus's route
    const stopMap = new Map<string, boolean>();
    const cumDists = getRouteDistances(route._id, coords);
    const segDist = getDistanceMetres(p1[1], p1[0], p2[1], p2[0]);
    const busInitDist = (cumDists[startIndex] || 0) + segDist * (((i * 3) % 10) / 10);

    for (const st of (route.stops || [])) {
      // If the bus has already reached/passed this stop's offset on this trip, boolean = false.
      // Otherwise, the bus hasn't reached it yet, boolean = true!
      const hasReached = busInitDist >= (st.offsetM || 0) + 40;
      stopMap.set(st.stopId, !hasReached);
    }
    busStopApproachingMap.set(bus._id, stopMap);
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
  registerSvgIcon(map, 'bus-icon-default', SVG_DEFAULT_BUS, 52);
  registerSvgIcon(map, 'bus-icon-ac', SVG_AC_BUS, 52);
  registerSvgIcon(map, 'bus-icon-electric', SVG_ELECTRIC_BUS, 52);
  registerSvgIcon(map, 'bus-icon-tracked', SVG_TRACKED_BUS, 64);
  registerSvgIcon(map, 'red-stop-pin', SVG_RED_PIN, 48);
  registerSvgIcon(map, 'bus-stop-icon', SVG_STOP_MARKER, 36);
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
        'line-color': '#FAFBF7',
        'line-width': 9,
        'line-opacity': 0.95,
      },
    });
  }

  // Selected route full path (subtle slate/teal highlighting full route of that bus)
  if (!map.getLayer('selected-route-full')) {
    map.addLayer({
      id: 'selected-route-full',
      type: 'line',
      source: 'selected-route',
      filter: ['any', ['==', 'type', 'full'], ['==', 'type', 'main']],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#80A48D',
        'line-width': 5,
        'line-opacity': 0.85,
      },
    });
  }

  // Selected route active path from bus to boarding and to destination (teal, shortens as the bus approaches)
  if (!map.getLayer('selected-route-active')) {
    map.addLayer({
      id: 'selected-route-active',
      type: 'line',
      source: 'selected-route',
      filter: ['any', ['==', 'type', 'active'], ['==', 'type', 'remaining']],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#45796D',
        'line-width': 5,
        'line-opacity': 1.0,
      },
    });
  }

  // Pinned Stops Source & Red Arrow/Pin Marker Layer (Boarding & Destination)
  if (!map.getSource('pinned-stops')) {
    map.addSource('pinned-stops', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer('pinned-stops-marker')) {
    map.addLayer({
      id: 'pinned-stops-marker',
      type: 'symbol',
      source: 'pinned-stops',
      layout: {
        'icon-image': 'red-stop-pin',
        'icon-size': 0.85,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'title'],
        'text-size': 11.5,
        'text-offset': [0, 0.4],
        'text-anchor': 'top',
        'text-optional': false,
      },
      paint: {
        'text-color': '#FAFBF7',
        'text-halo-color': '#1E2229',
        'text-halo-width': 3,
      },
    });
  }

  // Restore any existing pinned stops
  setPinnedStops(pinnedBoardingStop, pinnedDestStop);

  // Bus Stops Source & Layers
  if (!map.getSource('bus-stops')) {
    map.addSource('bus-stops', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: stopsData.map((s) => ({
          type: 'Feature',
          geometry: s.loc,
          properties: {
            id: s._id,
            name: s.name,
          },
        })),
      },
    });
  }

  // Small markers on bus stops (red dots with white border)
  if (!map.getLayer('bus-stops-circle')) {
    map.addLayer({
      id: 'bus-stops-circle',
      type: 'circle',
      source: 'bus-stops',
      minzoom: 12,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12, 2.5,
          14, 4.5,
          16, 6.5,
        ],
        'circle-color': '#45796D',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#FFFFFF',
        'circle-opacity': 0.92,
      },
    });

    map.on('mouseenter', 'bus-stops-circle', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'bus-stops-circle', () => {
      map.getCanvas().style.cursor = '';
    });
  }

  // Bus stop icons with name labels at zoom 14.5+
  if (!map.getLayer('bus-stops-icon-layer')) {
    map.addLayer({
      id: 'bus-stops-icon-layer',
      type: 'symbol',
      source: 'bus-stops',
      minzoom: 14.5,
      layout: {
        'icon-image': 'bus-stop-icon',
        'icon-size': 0.65,
        'icon-allow-overlap': false,
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.3],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': '#1E2229',
        'text-halo-color': '#FAFBF7',
        'text-halo-width': 2,
      },
    });

    map.on('mouseenter', 'bus-stops-icon-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'bus-stops-icon-layer', () => {
      map.getCanvas().style.cursor = '';
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

  // Vivid cyan glowing pulse layer when selected bus is tracked
  if (!map.getLayer('tracked-bus-pulse-ring')) {
    map.addLayer({
      id: 'tracked-bus-pulse-ring',
      type: 'circle',
      source: 'tracked-bus-pulse',
      paint: {
        'circle-radius': 22,
        'circle-color': '#D98E2B',
        'circle-opacity': 0.35,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-opacity': 0.9,
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
        'text-color': '#1E2229',
        'text-halo-color': '#FAFBF7',
        'text-halo-width': 2,
      },
    });

    map.on('mouseenter', 'buses-icon-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'buses-icon-layer', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', 'buses-icon-layer', (e) => {
      if (!e.features || !e.features[0]) return;
      const busId = e.features[0].properties?.busId || e.features[0].properties?.id;
      if (busId && onBusClickCallback) {
        onBusClickCallback(busId);
      }
    });
  }

  // Tracked bus symbol layer — Noticeably larger and distinct from other buses
  if (!map.getLayer('tracked-bus-icon-layer')) {
    map.addLayer({
      id: 'tracked-bus-icon-layer',
      type: 'symbol',
      source: 'tracked-bus',
      layout: {
        'icon-image': 'bus-icon-tracked',
        'icon-size': 1.25, // Noticeably larger than normal 0.72 buses
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'label'],
        'text-size': 13,
        'text-offset': [0, 1.45],
        'text-anchor': 'top',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#1E2229',
        'text-halo-color': '#D98E2B',
        'text-halo-width': 3,
      },
    });

    map.on('mouseenter', 'tracked-bus-icon-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'tracked-bus-icon-layer', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', 'tracked-bus-icon-layer', (e) => {
      if (!e.features || !e.features[0]) return;
      const busId = e.features[0].properties?.busId || e.features[0].properties?.id;
      if (busId && onBusClickCallback) {
        onBusClickCallback(busId);
      }
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
        'circle-color': '#2D6CDF',
        'circle-opacity': 0.12,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#2D6CDF',
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

      let hasLooped = false;
      if (sim.segmentProgress >= 1) {
        sim.segmentProgress = 0;
        const nextIdx = sim.coordIndex + 1;
        if (nextIdx >= coords.length - 1) {
          sim.coordIndex = 0;
          hasLooped = true;
        } else {
          sim.coordIndex = nextIdx;
        }
      }

      const currentP1 = coords[sim.coordIndex];
      const currentP2 = coords[(sim.coordIndex + 1) % coords.length];

      sim.lng = currentP1[0] + (currentP2[0] - currentP1[0]) * sim.segmentProgress;
      sim.lat = currentP1[1] + (currentP2[1] - currentP1[1]) * sim.segmentProgress;
      sim.heading = getBearing(currentP1[1], currentP1[0], currentP2[1], currentP2[0]);

      // Maintain individual boolean variable for each stop along the route
      let stopMap = busStopApproachingMap.get(busId);
      if (!stopMap) {
        stopMap = new Map<string, boolean>();
        busStopApproachingMap.set(busId, stopMap);
      }

      if (hasLooped) {
        // Reset all stop booleans to true for the new trip
        for (const st of (route.stops || [])) {
          stopMap.set(st.stopId, true);
        }
      } else {
        const cumDists = getRouteDistances(route._id, coords);
        const safeIdx = Math.min(sim.coordIndex, coords.length - 2);
        const segDist = getDistanceMetres(currentP1[1], currentP1[0], currentP2[1], currentP2[0]);
        const busRouteDistM = (cumDists[safeIdx] || 0) + segDist * sim.segmentProgress;

        for (const st of (route.stops || [])) {
          // Once a bus reaches the bus stop, set the boolean variable to false!
          if (stopMap.get(st.stopId) !== false) {
            if (busRouteDistM >= (st.offsetM || 0) - 25) {
              stopMap.set(st.stopId, false);
            }
          }
        }
      }

      // Update local position for fallback/standalone simulation
      const existing = liveBuses.get(busId);
      if (!existing || !existing.targetLat || existing.targetLat === existing.lat) {
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

    // Interpolate live server buses toward their targetLat/targetLng
    for (const bus of liveBuses.values()) {
      if (bus.targetLat !== undefined && bus.targetLng !== undefined) {
        const curLat = bus.interpolatedLat ?? bus.lat;
        const curLng = bus.interpolatedLng ?? bus.lng;

        // Smoothly interpolate towards target position (~50% per second)
        const alpha = Math.min(1, dt * 2.5);
        bus.interpolatedLat = curLat + (bus.targetLat - curLat) * alpha;
        bus.interpolatedLng = curLng + (bus.targetLng - curLng) * alpha;

        if (bus.targetHeading !== undefined) {
          bus.interpolatedHeading = bus.targetHeading;
        }
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

      const matchedRoute = meta?.routeId ? routeCatalog.get(meta.routeId) : null;
      const routeNo = matchedRoute?.routeNo || meta?.routeId?.split('-')[0] || '';

      const feature = {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat],
        },
        properties: {
          id: bus.busId,
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

    // Update dynamically shortening deep blue path for the tracked bus
    if (trackedBusId && mapInstance.getSource('selected-route')) {
      const sim = simVehicles.get(trackedBusId);
      const live = liveBuses.get(trackedBusId);
      const curLng = sim?.lng ?? live?.interpolatedLng ?? live?.lng;
      const curLat = sim?.lat ?? live?.interpolatedLat ?? live?.lat;

      const activeRouteId = trackedRouteId || sim?.routeId || (live?.routeId ?? null);
      const route = activeRouteId ? routeCatalog.get(activeRouteId) : null;

      if (
        curLng !== undefined &&
        curLat !== undefined &&
        route?.geometry?.coordinates &&
        route.geometry.coordinates.length >= 2
      ) {
        const coords = route.geometry.coordinates;

        // Target stop along route: destination if available, otherwise boarding stop
        let targetStop = route.stops?.find((s) => s.stopId === trackedDestStopId);
        if (!targetStop && trackedBoardingStopId) {
          targetStop = route.stops?.find((s) => s.stopId === trackedBoardingStopId);
        }

        let targetCoordIdx = coords.length - 1;
        if (targetStop) {
          const cumDists = getRouteDistances(route._id, coords);
          const stopOffset = targetStop.offsetM || 0;
          for (let c = 0; c < cumDists.length; c++) {
            if (cumDists[c] >= stopOffset) {
              targetCoordIdx = c;
              break;
            }
          }
        }

        const curIdx = sim ? sim.coordIndex : 0;
        const activeLegCoords: [number, number][] = [[curLng, curLat]];
        if (curIdx < targetCoordIdx) {
          for (let i = curIdx + 1; i <= targetCoordIdx; i++) {
            activeLegCoords.push(coords[i]);
          }
        }

        const selectedRouteSource = mapInstance.getSource('selected-route') as GeoJSONSource | undefined;
        if (selectedRouteSource) {
          selectedRouteSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: { type: 'full' },
              },
              ...(activeLegCoords.length >= 2
                ? [
                    {
                      type: 'Feature' as const,
                      geometry: { type: 'LineString' as const, coordinates: activeLegCoords },
                      properties: { type: 'active' },
                    },
                  ]
                : []),
            ],
          });
        }
      }
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
