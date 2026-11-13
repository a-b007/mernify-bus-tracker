export type BusType = 'AC' | 'Electric' | 'NonAC';

export function normalizeBusType(type?: string): BusType {
  const t = (type || '').toUpperCase();
  if (t === 'EV' || t === 'ELECTRIC') return 'Electric';
  if (t === 'AC') return 'AC';
  return 'NonAC';
}

export interface Stop {
  _id: string;
  name: string;
  loc: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  routeIds: string[];
  zone?: string;
}

export interface RouteStop {
  stopId: string;
  offsetM: number;
  seqNo: number;
}

export interface Route {
  _id: string;
  routeNo: string;
  direction: 'UP' | 'DN';
  origin: string;
  destination: string;
  type: BusType;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [[lng, lat], ...]
  };
  lengthM: number;
  stops: RouteStop[];
}

export interface Bus {
  _id: string;
  regNo: string;
  routeId: string;
  type: BusType;
  capacity: number;
  depot: string;
  destination: string;
}

export interface BusLiveState {
  busId: string;
  lat: number;
  lng: number;
  speed: number; // km/h
  heading: number; // 0-359
  seq: number;
  routeId?: string;
  progressM?: number;
  nextStopId?: string;
  occ?: number;
  delayS?: number;
  updatedAt: number;
  // History for interpolation
  prevLat?: number;
  prevLng?: number;
  prevHeading?: number;
  targetLat?: number;
  targetLng?: number;
  targetHeading?: number;
  interpolatedLat?: number;
  interpolatedLng?: number;
  interpolatedHeading?: number;
}

export interface EtaItem {
  busId: string;
  routeNo: string;
  etaS: number;
  confidence: string;
  stopId?: string;
}

export interface AlertItem {
  type: 'STUCK' | 'BUNCHING' | 'GEOFENCE' | 'DELAY_SPIKE';
  busId: string;
  routeId?: string;
  ts: string | number;
  details?: Record<string, any>;
}

export type JourneyStep =
  | 'welcome'
  | 'locating'
  | 'nearby'
  | 'destination'
  | 'busDetail'
  | 'tracking'
  | 'arriving'
  | 'done'
  | 'missed';

export interface JourneyFilters {
  ac: boolean;
  nonAc: boolean;
  electric: boolean;
  notCrowded: boolean;
  within10m: boolean;
}
