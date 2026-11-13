# MongoDB Data Model — bus_twin

## Collections

### `stops` — Bus Stop Locations (Real GPS)
```json
{
  "_id": "S0001",
  "name": "Majestic Bus Station",
  "loc": { "type": "Point", "coordinates": [77.5726, 12.9771] },
  "routeIds": ["335E-UP", "335E-DN", "500A-UP"],
  "zone": "central"
}
```
**Indexes**: `2dsphere` on `loc`, text index on `name`

### `routes` — Route Definitions (Real Geometry)
```json
{
  "_id": "335E-UP",
  "routeNo": "335E",
  "direction": "UP",
  "origin": "Kempegowda Bus Station",
  "destination": "ITPL",
  "type": "AC",
  "geometry": { "type": "LineString", "coordinates": [[77.5726, 12.9771], ...] },
  "lengthM": 24500,
  "stops": [
    { "stopId": "S0001", "offsetM": 0, "seqNo": 1 },
    { "stopId": "S0045", "offsetM": 1200, "seqNo": 2 }
  ]
}
```
**Indexes**: `routeNo`

### `buses` — Fleet Registration
```json
{
  "_id": "B0001",
  "regNo": "KA-57-F-1234",
  "routeId": "335E-UP",
  "type": "AC",
  "capacity": 52,
  "depot": "Shantinagar",
  "destination": "ITPL"
}
```
**Indexes**: `routeId`, `type`

### `bus_state` — Latest Position (In-Memory + Periodic Flush)
```json
{
  "_id": "B0001",
  "loc": { "type": "Point", "coordinates": [77.5986, 12.9823] },
  "speed": 28.5,
  "heading": 92,
  "progressM": 5400,
  "nextStopId": "S0112",
  "occ": 38,
  "delayS": 45,
  "emaSpeed": 26.3,
  "seq": 88500,
  "ts": "2024-11-13T10:30:00Z",
  "tripId": "T0001-42",
  "routeId": "335E-UP"
}
```
**Indexes**: `routeId`, optional `2dsphere` on `loc`

### `positions` — Time-Series History
**Type**: Time-Series Collection
```json
{
  "ts": "2024-11-13T10:30:00Z",
  "meta": { "busId": "B0001", "routeId": "335E-UP" },
  "lat": 12.9823,
  "lng": 77.5986,
  "speed": 28.5,
  "progressM": 5400,
  "occ": 38,
  "seq": 88500
}
```
**Config**: `timeField: ts`, `metaField: meta`, `granularity: seconds`, `expireAfterSeconds: 7200`

### `arrivals` — Stop Arrival Events
```json
{
  "busId": "B0001",
  "routeId": "335E-UP",
  "tripId": "T0001-42",
  "stopId": "S0112",
  "ts": "2024-11-13T10:35:00Z",
  "delayS": 45,
  "headwayS": 420
}
```
**Indexes**: `UNIQUE (busId, tripId, stopId)`, `(stopId, ts)`, TTL on `ts` = 48h

### `stop_hourly_stats` — Roll-Up Analytics
```json
{
  "stopId": "S0112",
  "routeId": "335E-UP",
  "dayType": "WEEKDAY",
  "hour": 10,
  "n": 24,
  "sumHeadwayS": 10080,
  "sumDelayS": 1080,
  "minHeadwayS": 180,
  "maxHeadwayS": 720
}
```
**Indexes**: `UNIQUE (stopId, routeId, dayType, hour)`

### `alerts` — Anomaly Alerts
```json
{
  "type": "STUCK",
  "busId": "B0001",
  "routeId": "335E-UP",
  "ts": "2024-11-13T10:40:00Z",
  "details": { "stuckSince": "2024-11-13T10:37:00Z", "location": [77.598, 12.982] }
}
```
**Indexes**: TTL on `ts` = 3 days, `(ts)`

### `users` — Authentication
```json
{
  "email": "admin@bustwin.in",
  "passwordHash": "$2b$10$...",
  "role": "admin"
}
```
**Indexes**: `UNIQUE email`

## Storage Budget (500MB Cap)
| Collection | Policy | Estimated Size |
|------------|--------|----------------|
| stops, routes, buses | Static, loaded once | ~10 MB |
| bus_state | 600 docs, upsert | < 1 MB |
| positions (TS) | TTL 2h, 72K docs/hr | ~17 MB |
| arrivals | TTL 48h, 15K/hr | ≤100 MB |
| stop_hourly_stats | Bounded, never grows | ~15 MB |
| alerts | TTL 3 days | < 2 MB |
| **Total** | | **~150 MB (30%)** |
