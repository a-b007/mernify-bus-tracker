# Event & API Contract

## Telemetry Event (Simulator → Server)

```json
{
  "busId": "B0412",
  "seq": 88213,
  "ts": 1731500400123,
  "lat": 12.97712,
  "lng": 77.57261,
  "speed": 23.4,
  "heading": 87,
  "occ": 41
}
```

### Field Rules
- `busId`: Stable string ID (e.g., "B0001" to "B0600")
- `seq`: Monotonic per bus. Server drops events where seq ≤ lastSeq
- `ts`: Device UTC timestamp in milliseconds
- `lat/lng`: WGS84 decimal degrees (Bengaluru: lat ~12.8-13.1, lng ~77.4-77.8)
- `speed`: km/h (0-80 typical)
- `heading`: 0-359 degrees
- `occ`: Passengers onboard (optional)

### Server-Derived Fields (NOT sent by device)
- `routeId`: Matched from bus registration
- `progressM`: Metres along route (snapped via turf.nearestPointOnLine)
- `nextStopId`: Next upcoming stop
- `delayS`: Seconds of delay
- `emaSpeed`: Exponential moving average speed

## Ingest Batch

```
POST /api/ingest/batch
Headers: x-api-key: <INGEST_API_KEY>
Content-Type: application/json

Body: { "events": [ ...telemetry events ] }
```

- Max batch size: 1000 events
- Rate limit: 60 requests/minute per API key
- Rejects: stale seq, impossible jumps (>speed×elapsed×2 forward, >50m backward)

## REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/register` | POST | Register user (email, password) |
| `/api/auth/login` | POST | Login, returns JWT |
| `/api/routes` | GET | All route metadata |
| `/api/stops?bbox=` | GET | Stops in bounding box |
| `/api/buses/:id` | GET | Bus details + latest state |
| `/api/buses/:id/history?from&to` | GET | Position trail from time-series |
| `/api/stops/:id/eta` | GET | Current ETA list |
| `/api/stops/:id/arrivals?from&to&routeId` | GET | Raw arrival events |
| `/api/stops/:id/stats?dayType&routeId` | GET | Hourly roll-ups |
| `/api/admin/sim/fault` | POST | Inject fault (admin only) |

## Socket.IO Events

### Client → Server
| Event | Payload | Purpose |
|-------|---------|---------|
| `viewport:set` | `{cells:[ids]}` | Subscribe to grid cells |
| `route:sub` | `{routeId}` | Subscribe to route room |
| `route:unsub` | `{routeId}` | Unsubscribe from route room |
| `stop:sub` | `{stopId}` | Subscribe to stop (triggers ETA) |
| `stop:unsub` | `{stopId}` | Unsubscribe from stop |

### Server → Client
| Event | Payload | Purpose |
|-------|---------|---------|
| `snapshot` | Full bus state for subscribed cells | Sent once on join |
| `pos:delta` | `{batchSeq, t, rows:[[idx,lat,lng,speed,hdg,seq],...]}` | Every 2s, moved buses only |
| `eta:update` | `{stopId, items:[{busId, routeNo, etaS, confidence}]}` | Every 5s for subscribed stops |
| `alert:new` | Alert object | Admins=all, viewers=subscribed routes |

### Socket Auth
JWT in handshake `auth` field, verified in `io.use()` middleware.

## Delta Format
Coordinates encoded as integers (×1e5) to reduce payload size.
`rows: [[busIndex, 1297712, 7757261, 234, 87, 88213], ...]`
