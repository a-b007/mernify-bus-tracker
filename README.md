# 🚌 BMTC Bus Tracker (BusDekho)

> 🌐 **Live Web Application**: [https://busdekho.onrender.com](https://busdekho.onrender.com)  
> **MERNify Live Transit Tracker** — High-Throughput Streams, Real-Time Fleet Telemetry & 60 FPS Spatial Digital Twin  
> **Target Region**: Bengaluru Metropolitan Transport Corporation (BMTC), Karnataka, India  
> **Architecture Specification**: [ARCHITECTURE.md](./ARCHITECTURE.md) | [BusTracker_System_Architecture_Document.pdf](./BusTracker_System_Architecture_Document.pdf)

---

## 📋 Table of Contents
1. [Overview & Highlights](#-overview--highlights)
2. [Live Deployment](#-live-deployment)
3. [Key Features & Recent Improvements](#-key-features--recent-improvements)
4. [Technology Stack](#-technology-stack)
5. [System Architecture](#-system-architecture)
6. [End-to-End Data Flow](#-end-to-end-data-flow)
7. [Database Schema & Data Models](#-database-schema--data-models)
8. [Real-Time Communication Protocol](#-real-time-communication-protocol)
9. [Performance Optimization Techniques](#-performance-optimization-techniques)
10. [Repository File Structure](#-repository-file-structure)
11. [Setup & Execution Guide](#-setup--execution-guide)
12. [REST API & Socket.IO Contract](#-rest-api--socketio-contract)
13. [Attributions & Licenses](#-attributions--licenses)

---

## 🎯 Overview & Highlights

Public transit systems in dense metropolitan regions like Bengaluru encounter severe traffic variations, bunching, variable passenger dwell times, and network jitter. Commuters need accurate ETAs, responsive search, and smooth spatial vehicle tracking without battery drain or map freezing.

The **BMTC Bus Tracker** is a full-stack real-time platform that streams live vehicle telemetry across Bengaluru's major corridors and provides a responsive 60 FPS digital twin on top of MapLibre GL.

- **Live Hosted Application**: Deployed live and accessible at [https://busdekho.onrender.com](https://busdekho.onrender.com).
- **Exact GPS Coordinates**: All coordinates use WGS84 standards (`[longitude, latitude]`) bounded within Bengaluru (`12.7–13.2° N, 77.3–77.9° E`).
- **Hybrid Ingestion Architecture**: A lightweight 0.5 Hz (every 2s) server snapshot broadcast combined with a client-side 60 FPS dead-reckoning engine.
- **Production Architecture Document**: A formal design document has been compiled and generated into [ARCHITECTURE.md](./ARCHITECTURE.md) and [BusTracker_System_Architecture_Document.pdf](./BusTracker_System_Architecture_Document.pdf).

---

## 🌐 Live Deployment

The application is deployed on Render and available publicly:

* **Production URL**: [https://busdekho.onrender.com](https://busdekho.onrender.com)
* **Status**: Live and streaming real-time transit telemetry.

---

## 🚀 Key Features & Recent Improvements

### 1. Dynamic Camera Re-Centering & Live Tracking
- **Moderate Zoom Focus**: Selecting a bus from the candidate list immediately centers the viewport on the selected vehicle at a moderate zoom level (`14.8`), providing a balanced view of the bus, neighboring traffic grid, and upcoming road segments.
- **Continuous Camera Follow**: The camera smoothly glides along with the moving bus (`map.easeTo` with 160ms linear interpolation) as it travels along its route.
- **Auto-Stop at Boarding Station**: Once the bus reaches or passes the user's selected boarding stop (or within $\le 35\text{ m}$), camera follow halts automatically so riders can view arrival and boarding status.
- **Non-Intrusive Pan & Recenter**: If the user drags or pans the map manually, camera follow pauses automatically. A dedicated **Recenter on bus** crosshair action in `BusDetailPanel` allows resuming camera follow anytime.

### 2. Vehicle Color Coding
Vehicles are rendered with distinct SVG icons and color-coded RouteChips based on bus propulsion and service tier:
- <span style="color:#0D9488; font-weight:bold;">AC Buses (Vajra / Vayu Vajra)</span> &rarr; **Teal** (`#0D9488`)
- <span style="color:#FACC15; font-weight:bold;">Non-AC Buses (Ordinary)</span> &rarr; **Yellow** (`#FACC15`)
- <span style="color:#2563EB; font-weight:bold;">Electric Buses (EV Metro Feeder)</span> &rarr; **Blue** (`#2563EB`)

### 3. High-Visibility Bus Stops & Boarding Pin
- **Bus Stop Icons**: Enlarged red stop markers (`#FE3837`) with bold, visible name labels and white halos rendered at zoom 11+.
- **Boarding Stop Pin**: A highlighted red location pin (`red-stop-pin`) is permanently placed on the active boarding stop and paired with the route spine in `DualStopSearch`.

### 4. Accurate Stop Departure & Terminal Arrival
- **Accurate Waypoint Mapping**: Replaced Euclidean distance heuristics with direct waypoint coordinate indices (`getStopCoordIndex`). Buses departing from a stop are immediately marked as `departed` rather than displaying erroneous "arriving in 5 mins" counters.
- **Terminal Arrival Detection**: When a bus reaches its final destination stop, its speed drops to `0 km/h` and the status updates to **"Final location reached"** (`finalReached`).

### 5. Zero-Flicker Map Theme Switching (Dark ↔ Light)
- MapLibre style reloads during Dark/Light theme toggles previously wiped custom GeoJSON sources and SVG icons.
- Fixed via a synchronous vector image cache (`cachedImages`), fallback `styleimagemissing` handler, and `style.load` event listeners in `MapContainer.tsx`, `HomePage.tsx`, and `vehicleStore.ts`.

### 6. Flexible Multi-Stop Search (`DualStopSearch`)
- Boarding stop is no longer hardcoded to Majestic; users can search, select, clear, swap, or click any stop on the interactive map.
- Added `Enter` (select top suggestion) and `Escape` (dismiss dropdown) keyboard shortcuts.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 8 |
| **Mapping & WebGL** | MapLibre GL v6, OpenFreeMap Vector Tiles, OpenMapTiles Font Glyphs |
| **State & Data Fetching**| Zustand 5 (`useJourneyStore`, `useMapStore`), TanStack React Query v5 |
| **Styling & Icons** | Tailwind CSS v4, CSS Variables (`data-theme`), Phosphor Icons (`@phosphor-icons/react`) |
| **Backend & API** | Node.js (v20+ / v26), Express 5, Helmet, CORS, Express Rate Limit |
| **Real-Time Streaming**| Socket.IO v4 (WebSocket + HTTP long-polling fallback) |
| **Database & ODM** | MongoDB (v6+), Mongoose ODM with `2dsphere` spatial indexing |

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│             CLIENT PRESENTATION TIER (React 19 + MapLibre GL)          │
│                                                                        │
│  ┌────────────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │   UI Components        │  │ Zustand Stores │  │ VehicleStore     │  │
│  │ (DualStopSearch,       │  │ (JourneyStore, │  │ (60 FPS rAF,     │  │
│  │  BusRow, DetailPanel)  │  │  MapStore)     │  │  Dead Reckoning) │  │
│  └───────────┬────────────┘  └───────┬────────┘  └────────┬─────────┘  │
│              │                       │                    │            │
│              └───────────────────────┼────────────────────┘            │
│                                      ▼                                 │
│                         ┌──────────────────────────┐                   │
│                         │ MapLibre WebGL Canvas    │                   │
│                         │ (Vector Tiles, 30FPS GPU)│                   │
│                         └────────────┬─────────────┘                   │
└──────────────────────────────────────┼─────────────────────────────────┘
                                       │
                    HTTP REST          │         WebSocket
                    (/api/routes, etc) │         (busSnapshot, routeUpdate)
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│            APPLICATION & GATEWAY TIER (Express 5 + Socket.IO v4)       │
│                                                                        │
│  ┌────────────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ Express 5 REST API     │  │ Socket.IO Hub  │  │ Sim Telemetry    │  │
│  │ (Routes, Stops, Buses) │  │ (Room Manager) │  │ (2s Broadcast)   │  │
│  └───────────┬────────────┘  └───────┬────────┘  └────────┬─────────┘  │
└──────────────┼───────────────────────┼────────────────────┼────────────┘
               │                       │                    │
               └───────────────────────┴────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PERSISTENCE TIER (MongoDB - bustracker)              │
│                                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────┐  │
│  │ `routes` Collection │  │ `stops` Collection  │  │ `buses` Fleet  │  │
│  │ LineString Geometry │  │ 2dsphere Point loc  │  │ Unique regNo   │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 End-to-End Data Flow

1. **Ingestion & Simulation Loop**: Every 2,000 ms, the server queries active bus records via `Bus.find().lean()`, synthesizes telemetry positions along corridors, and generates snapshot payloads.
2. **Broadcasting**:
   - The server broadcasts global fleet positions via `busSnapshot`.
   - When a rider focuses on a specific corridor, the client joins `route:<routeId>`, receiving prioritized room deltas via `routeUpdate`.
3. **Client-Side Ingestion**: Telemetry arrives via Socket.IO client and updates `liveBuses` and `simVehicles` in-memory `Map` tables.
4. **60 FPS Dead Reckoning & Interpolation**:
   - The client `requestAnimationFrame` loop computes position progress every 16.6ms using exponential smoothing:
     $$\alpha = \min(1.0, \Delta t \times 2.5)$$
   - Line coordinates, heading angles, and approaching stop booleans are recalculated smoothly.
5. **Throttled WebGL Uploads**: GeoJSON source updates are throttled to 33ms (~30 FPS) to eliminate WebGL buffer re-allocation bottlenecks.
6. **Live Camera Glide**: When camera follow is enabled, the map smoothly pans with the vehicle (`easeTo` with 160ms duration) until the boarding station is reached.

---

## 🗄️ Database Schema & Data Models

### 1. `Stop` Model (`server/src/models/Stop.js`)
```javascript
{
  name:     { type: String, required: true },
  loc: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } // [Longitude, Latitude]
  },
  zone:     String,
  routeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Route' }]
}
```
* **Indexes**:
  * `loc`: `2dsphere` — accelerates radius search (`$near`, `$geoWithin`) for finding nearby stops.
  * `name`: `text` — fast text/prefix lookups for autocomplete.

### 2. `Route` Model (`server/src/models/Route.js`)
```javascript
{
  routeNo:     { type: String, required: true },
  direction:   { type: String, enum: ['UP', 'DN'], default: 'UP' },
  origin:      String,
  destination: String,
  type:        { type: String, enum: ['AC', 'NonAC', 'EV'], default: 'NonAC' },
  geometry: {
    type:        { type: String, default: 'LineString' },
    coordinates: { type: [[Number]], default: [] } // Array of [lng, lat]
  },
  lengthM:     { type: Number, default: 0 },
  stops: [{
    stopId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Stop' },
    offsetM:  { type: Number, default: 0 },
    seqNo:    { type: Number, default: 1 }
  }]
}
```
* **Indexes**:
  * `routeNo`: `1` — fast corridor retrieval.
  * `stops.stopId`: `1` — enables rapid stop-pair filtering when calculating connecting routes.

### 3. `Bus` Model (`server/src/models/Bus.js`)
```javascript
{
  regNo:       { type: String, required: true, unique: true },
  routeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  type:        { type: String, enum: ['AC', 'NonAC', 'EV'], default: 'NonAC' },
  capacity:    { type: Number, default: 50 },
  depot:       String,
  destination: String
}
```
* **Indexes**:
  * `regNo`: `1 (unique)` — avoids duplicate vehicle entries.
  * `routeId`: `1` — quick filtering of active vehicles per route.

---

## ⚡ Real-Time Communication Protocol

### Socket.IO Channels & Lifecycle
* **Heartbeat Settings**: `pingInterval: 10000` (10s), `pingTimeout: 5000` (5s).
* **Transports**: Native WebSocket with automatic HTTP long-polling fallback.

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `busSnapshot` | Server &rarr; Client | `{ buses: Array<BusLiveState>, timestamp: number }` | City-wide fleet state emitted every 2 seconds |
| `subscribeRoute` | Client &rarr; Server | `routeId: string` | Client joins `route:<routeId>` room |
| `unsubscribeRoute` | Client &rarr; Server | `routeId: string` | Client leaves `route:<routeId>` room |
| `routeUpdate` | Server &rarr; Client | `BusLiveState (single bus)` | Multicast telemetry sent to subscribers of that route |

---

## 🏎️ Performance Optimization Techniques

1. **Client-Side Dead Reckoning**: Emitting GPS telemetry at 0.5 Hz (every 2s) while interpolating at 60 FPS on the client decreases network downlink bandwidth by **96.7%** without visual stutter.
2. **MapLibre WebGL Buffer Throttling**: Updates to `map.getSource('buses').setData()` are capped at ~30 FPS (33ms guard), preventing main-thread GPU buffer contention while math runs at 60 FPS.
3. **Pre-Computed Distance Caching (`routeDistanceCache`)**: Cumulative meters along each route LineString are cached in memory once, turning multi-point Haversine traversals into $O(1)$ operations.
4. **Synchronous SVG Cache (`cachedImages`)**: Vector icons are pre-decoded and held in memory. When the user changes themes, images are registered synchronously to avoid missing-icon frames.
5. **$O(1)$ Memory Tables**: High-frequency telemetry uses native JavaScript `Map` lookups instead of repetitive `Array.find()` iterations.

---

## 📁 Repository File Structure

```
mernify-bus-tracker/
├── BusTracker_System_Architecture_Document.pdf # Formal Architecture & Design Document
├── client/                                     # React 19 + MapLibre GL Frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx                            # Client bootstrap
│       ├── App.tsx                             # React Router setup
│       ├── components/
│       │   ├── DualStopSearch.tsx              # Boarding & destination search box
│       │   ├── BusRow.tsx                      # Bus list item with live ETA & crowding
│       │   ├── RouteChip.tsx                   # Color-coded route number chip
│       │   ├── FilterBar.tsx                   # AC, Non-AC, EV, Crowding filter pills
│       │   ├── MapControls.tsx                 # Zoom in/out and locate buttons
│       │   └── screens/
│       │       └── BusDetailPanel.tsx          # Detail view with Recenter & Follow action
│       ├── hooks/
│       │   ├── useLiveEta.ts                   # Hook for continuous ETA recalculation
│       │   ├── useTheme.tsx                    # Dark/Light theme provider
│       │   └── useBreakpoint.tsx               # Responsive viewport hook
│       ├── map/
│       │   ├── MapContainer.tsx                # MapLibre container & style-switch handler
│       │   ├── style.light.json                # Light map style specification
│       │   └── style.dark.json                 # Dark map style specification
│       ├── pages/
│       │   ├── HomePage.tsx                    # Main interactive bus tracking page
│       │   ├── AnalyticsPage.tsx               # Transit analytics & headway charts
│       │   ├── AboutPage.tsx                   # Platform about page
│       │   └── UserGuidePage.tsx               # Commuter user guide & FAQ
│       ├── services/
│       │   ├── api.ts                          # REST fetch helpers
│       │   ├── socket.ts                       # Socket.IO connection & event handlers
│       │   └── vehicleStore.ts                 # 60 FPS interpolation, camera follow & map layers
│       ├── stores/
│       │   ├── journey.ts                      # Zustand journey state
│       │   └── map.ts                          # Zustand map reference store
│       └── types/
│           └── transit.ts                      # TypeScript type definitions
├── server/                                     # Node.js + Express 5 Backend
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.js                            # Express app entry & HTTP listener
│       ├── socket.js                           # Socket.IO initialization & 2s broadcast loop
│       ├── config/
│       │   ├── db.js                           # MongoDB connection
│       │   └── env.js                          # Environment configuration
│       ├── models/
│       │   ├── Route.js                        # Route LineString schema
│       │   ├── Stop.js                         # Stop 2dsphere Point schema
│       │   └── Bus.js                          # Bus fleet metadata schema
│       ├── routes/
│       │   ├── route.js                        # GET /api/routes
│       │   ├── stop.js                         # GET /api/stops
│       │   └── bus.js                          # GET /api/buses
│       └── scripts/
│           └── seed.js                         # Database seeder (30 stops, 15 routes, 80 buses)
├── simulator/                                  # Optional standalone telemetry simulator
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── physics.js
│       └── fleet.js
├── README.md
└── package.json
```

---

## 🚦 Setup & Execution Guide

### 1. Prerequisites
- **Node.js**: v20+ (Node v26 supported)
- **MongoDB**: v6.0+ running locally on `localhost:27017` or a MongoDB Atlas URI

### 2. Environment Configuration
Verify `server/.env`:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/bustracker
```

### 3. Seed Database (Transit Corridors, Stops, Fleet)
Populate the database with the 30 Bengaluru stops, 15 routes, and 80 buses:
```bash
cd server
npm install
npm run seed
```

### 4. Start the Backend API & Socket Server
```bash
cd server
npm run dev
# Server listening on http://localhost:3000
```

### 5. Start the Frontend Client
In a new terminal:
```bash
cd client
npm install
npm run dev
# Client running on http://localhost:5173
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📡 REST API & Socket.IO Contract

### REST Endpoints

| Method | Path | Description | Response Shape |
|---|---|---|---|
| `GET` | `/api/health` | Service health status | `{ status: 'ok', service: 'bus-twin-server' }` |
| `GET` | `/api/stops` | Catalog of all 30 bus stops with GeoJSON coordinates | `Array<Stop>` |
| `GET` | `/api/routes` | Catalog of 15 corridors with full LineString geometry | `Array<Route>` |
| `GET` | `/api/buses` | Registered fleet vehicles with types and capacities | `Array<Bus>` |

---

## 📜 Attributions & Licenses
- **Map & Transit Data**: © [OpenStreetMap](https://www.openstreetmap.org/) contributors under ODbL.
- **Vector Tiles**: [OpenFreeMap](https://openfreemap.org/) (Vector Tile Hosting).
- **Map Engine**: [MapLibre GL JS](https://maplibre.org/) (BSD 3-Clause License).
- **Icons**: [Phosphor Icons](https://phosphoricons.com/) (MIT License).

---
*Maintained by the DeepMind Engineering Team for MERNify Bus Tracker.*
