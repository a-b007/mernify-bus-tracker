import { CELL_SIZE_KM, BBOX } from './constants.js';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance between two points in metres.
 */
export function haversineM(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
}

/**
 * Compute grid cell ID from lat/lng.
 * Grid of CELL_SIZE_KM squares anchored at BBOX min corner.
 */
export function latLngToCellId(lat, lng) {
  const latDeg = CELL_SIZE_KM / 111.32; // ~km per degree latitude
  const lngDeg = CELL_SIZE_KM / (111.32 * Math.cos(((BBOX.minLat + BBOX.maxLat) / 2) * DEG_TO_RAD));

  const row = Math.floor((lat - BBOX.minLat) / latDeg);
  const col = Math.floor((lng - BBOX.minLng) / lngDeg);

  return `${row}:${col}`;
}

/**
 * Return array of cell IDs covering a bounding box.
 */
export function bboxToCellIds(minLat, minLng, maxLat, maxLng) {
  const cells = [];
  const latDeg = CELL_SIZE_KM / 111.32;
  const lngDeg = CELL_SIZE_KM / (111.32 * Math.cos(((BBOX.minLat + BBOX.maxLat) / 2) * DEG_TO_RAD));

  const startRow = Math.floor((minLat - BBOX.minLat) / latDeg);
  const endRow = Math.floor((maxLat - BBOX.minLat) / latDeg);
  const startCol = Math.floor((minLng - BBOX.minLng) / lngDeg);
  const endCol = Math.floor((maxLng - BBOX.minLng) / lngDeg);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      cells.push(`${r}:${c}`);
    }
  }
  return cells;
}

/**
 * Encode lat/lng as integer × 1e5.
 */
export function encodeCoord(val) {
  return Math.round(val * 1e5);
}
