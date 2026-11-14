// Great-circle distance between two points in metres
export function getDistanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Bearing / Heading in degrees (0-359) from point 1 to point 2
export function getBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}

const CELL_SIZE_KM = 2;
const BBOX = { minLat: 12.7, maxLat: 13.2, minLng: 77.3, maxLng: 77.9 };
const DEG_TO_RAD = Math.PI / 180;

export function bboxToCellIds(minLat: number, minLng: number, maxLat: number, maxLng: number): string[] {
  const cells: string[] = [];
  const latDeg = CELL_SIZE_KM / 111.32;
  const lngDeg = CELL_SIZE_KM / (111.32 * Math.cos(((BBOX.minLat + BBOX.maxLat) / 2) * DEG_TO_RAD));

  const startRow = Math.max(0, Math.floor((minLat - BBOX.minLat) / latDeg));
  const endRow = Math.min(27, Math.floor((maxLat - BBOX.minLat) / latDeg));
  const startCol = Math.max(0, Math.floor((minLng - BBOX.minLng) / lngDeg));
  const endCol = Math.min(32, Math.floor((maxLng - BBOX.minLng) / lngDeg));

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      cells.push(`${r}:${c}`);
    }
  }
  return cells;
}
