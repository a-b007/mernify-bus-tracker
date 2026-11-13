// Grid cell size in km
export const CELL_SIZE_KM = 2;

// Bengaluru bounding box
export const BBOX = {
  minLat: 12.7,
  maxLat: 13.2,
  minLng: 77.3,
  maxLng: 77.9,
};

// Room prefixes
export const ROOM = {
  CELL: 'cell:',
  ROUTE: 'route:',
  STOP: 'stop:',
};

// Alert types
export const ALERT_TYPE = {
  STUCK: 'STUCK',
  BUNCHING: 'BUNCHING',
  GEOFENCE: 'GEOFENCE',
  DELAY_SPIKE: 'DELAY_SPIKE',
};

// Alert cooldown in ms (5 minutes)
export const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

// Position delta broadcast interval (ms)
export const DELTA_INTERVAL_MS = 2000;

// EMA smoothing factor (α ≈ 0.1)
export const EMA_ALPHA = 0.1;

// Arrival detection threshold (metres)
export const ARRIVAL_THRESHOLD_M = 40;

// Stuck detection thresholds
export const STUCK_SPEED_KMH = 2;
export const STUCK_DURATION_S = 180;

// Bunching detection threshold (metres)
export const BUNCHING_THRESHOLD_M = 200;

// Jump rejection thresholds
export const MAX_BACKWARD_JUMP_M = 50;

// Coordinate encoding multiplier for delta payloads
export const COORD_MULTIPLIER = 1e5;

// History sampling rate (1 in N events saved)
export const HISTORY_SAMPLE_RATE = 15;

// Maximum batch size for ingest
export const MAX_BATCH_SIZE = 1000;
