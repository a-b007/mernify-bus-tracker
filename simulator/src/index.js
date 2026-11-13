/**
 * index.js — Entry point for the Bengaluru bus simulator.
 *
 * Env vars:
 *   FLEET_SIZE        (default 600)
 *   TICK_MS           (default 1000)
 *   SEND_INTERVAL_MS  (default 2000)
 *   TIME_SCALE        (default 1, >1 speeds up sim time)
 *   INGEST_URL        (default http://localhost:3001/api/ingest/batch)
 *   INGEST_API_KEY    (default "dev-key")
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createBus, tickBus } from "./fleet.js";
import { createSender } from "./sender.js";
import { listenStdin } from "./faults.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────
const FLEET_SIZE = parseInt(process.env.FLEET_SIZE ?? "600", 10);
const TICK_MS = parseInt(process.env.TICK_MS ?? "1000", 10);
const SEND_INTERVAL_MS = parseInt(process.env.SEND_INTERVAL_MS ?? "2000", 10);
const TIME_SCALE = parseFloat(process.env.TIME_SCALE ?? "1");
const INGEST_URL =
  process.env.INGEST_URL ?? "http://localhost:3001/api/ingest/batch";
const INGEST_API_KEY = process.env.INGEST_API_KEY ?? "dev-key";

// ─── Load Data ───────────────────────────────────────────────────────
function tryLoadJSON(relPath) {
  try {
    const p = resolve(__dirname, relPath);
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

let routes = tryLoadJSON("../../data/routes.json") ?? tryLoadJSON("../tests/fixtures/routes.json");
let buses = tryLoadJSON("../../data/buses.json") ?? tryLoadJSON("../tests/fixtures/buses.json");

if (routes && buses) {
  console.log(
    `[sim] loaded ${routes.length} routes, ${buses.length} buses`
  );
} else {
  console.warn("[sim] data files not found, generating synthetic fleet");
  routes = null;
  buses = null;
}

// ─── Build Route Map ─────────────────────────────────────────────────
const routeMap = new Map();
if (routes) {
  for (const r of routes) {
    const id = r.routeId ?? r._id;
    r.routeId = id;
    routeMap.set(id, r);
  }
}

// Fallback: generate a synthetic circular route in Bengaluru
function syntheticRoute(id) {
  // Create a rough loop through central Bengaluru (~15km)
  const coords = [
    [77.5946, 12.9716], // Majestic
    [77.6088, 12.9766], // City Railway Station
    [77.6205, 12.9852], // Shivajinagar
    [77.6350, 12.9780], // Indiranagar
    [77.6410, 12.9620], // Domlur
    [77.6250, 12.9500], // Koramangala
    [77.6100, 12.9400], // BTM Layout
    [77.5900, 12.9450], // Jayanagar
    [77.5750, 12.9550], // Basavanagudi
    [77.5700, 12.9650], // Chamarajpet
    [77.5850, 12.9716], // Back toward Majestic
    [77.5946, 12.9716], // Majestic (close loop)
  ];
  return {
    routeId: id,
    geometry: { type: "LineString", coordinates: coords },
    stops: [],
  };
}

// ─── Generate Fleet ──────────────────────────────────────────────────
const fleet = new Map();

const BUS_TYPES = ["NON_AC", "AC", "EV"];

function genRegNo(idx) {
  const num = String(idx).padStart(4, "0");
  return `KA-57-F-${num}`;
}

if (buses && routes) {
  // Use data-agent's bus assignments
  const limit = Math.min(buses.length, FLEET_SIZE);
  for (let i = 0; i < limit; i++) {
    const b = buses[i];
    const routeId = b.routeId ?? b.route_id;
    const route = routeMap.get(routeId);
    if (!route) continue;
    const busId = b.busId ?? b._id ?? `B${String(i + 1).padStart(4, "0")}`;
    const regNo = b.regNo ?? genRegNo(i + 1);
    const busType = b.busType ?? b.type ?? BUS_TYPES[i % 3];
    const bus = createBus(busId, regNo, busType, route, routeId);

    // Wire up reverse route if available
    const baseId = routeId.replace(/-UP$|-DN$/, "");
    const revId =
      routeId.endsWith("-UP") ? `${baseId}-DN` : `${baseId}-UP`;
    if (routeMap.has(revId)) bus.reverseRoute = routeMap.get(revId);

    fleet.set(busId, bus);
  }
  console.log(`[sim] initialized ${fleet.size} buses from data files`);
} else {
  // Synthetic fleet
  const synRoutes = [];
  const routeNames = [
    "335E-UP", "500C-UP", "401-UP", "201R-UP", "KBS4-UP",
    "365-UP", "171-UP", "252A-UP", "314-UP", "600M-UP",
  ];
  for (const name of routeNames) {
    const r = syntheticRoute(name);
    synRoutes.push(r);
    routeMap.set(name, r);
    // Create reverse
    const revName = name.replace("-UP", "-DN");
    const revRoute = {
      ...r,
      routeId: revName,
      geometry: {
        type: "LineString",
        coordinates: [...r.geometry.coordinates].reverse(),
      },
    };
    routeMap.set(revName, revRoute);
  }

  for (let i = 0; i < FLEET_SIZE; i++) {
    const busId = `B${String(i + 1).padStart(4, "0")}`;
    const regNo = genRegNo(i + 1);
    const busType = BUS_TYPES[i % 3];
    const routeName = routeNames[i % routeNames.length];
    const route = routeMap.get(routeName);
    const bus = createBus(busId, regNo, busType, route, routeName);
    const revName = routeName.replace("-UP", "-DN");
    bus.reverseRoute = routeMap.get(revName);
    fleet.set(busId, bus);
  }
  console.log(
    `[sim] initialized ${fleet.size} synthetic buses on ${routeNames.length} routes`
  );
}

// ─── Sender ──────────────────────────────────────────────────────────
const sender = createSender(INGEST_URL, INGEST_API_KEY, SEND_INTERVAL_MS);
sender.start();

// ─── Fault Injection via Stdin ───────────────────────────────────────
listenStdin(fleet);

// ─── Simulation Loop ─────────────────────────────────────────────────
let simTime = Date.now();
let tickCount = 0;
let totalEventsSent = 0;

function tick() {
  const dtReal = TICK_MS / 1000;
  const dtSim = dtReal * TIME_SCALE;
  simTime += dtSim * 1000;

  const simDate = new Date(simTime);
  const simHour = simDate.getUTCHours();

  const events = [];
  for (const bus of fleet.values()) {
    const ev = tickBus(bus, dtSim, simHour);
    if (ev) {
      ev.ts = Math.floor(simTime); // use sim time
      events.push(ev);
    }
  }

  sender.enqueue(events);
  totalEventsSent += events.length;
  tickCount++;

  // Log stats every 10s
  if (tickCount % Math.max(1, Math.round(10000 / TICK_MS)) === 0) {
    const running = [...fleet.values()].filter(
      (b) => b.state === "RUNNING"
    ).length;
    const avgSpeed =
      [...fleet.values()]
        .filter((b) => b.state === "RUNNING")
        .reduce((s, b) => s + b.speed, 0) / (running || 1);
    const senderStats = sender.stats();
    console.log(
      `[sim] tick=${tickCount} | active=${running}/${fleet.size} | avgSpeed=${avgSpeed.toFixed(1)} km/h | sent=${senderStats.totalSent} | errors=${senderStats.totalErrors} | pending=${senderStats.pending}`
    );
  }
}

const tickTimer = setInterval(tick, TICK_MS);

console.log(
  `[sim] started — fleet=${fleet.size} tick=${TICK_MS}ms send=${SEND_INTERVAL_MS}ms scale=${TIME_SCALE}x → ${INGEST_URL}`
);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[sim] shutting down...");
  clearInterval(tickTimer);
  sender.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(tickTimer);
  sender.stop();
  process.exit(0);
});
