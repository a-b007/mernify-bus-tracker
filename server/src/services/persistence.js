import { getDB, isDBConnected } from '../config/db.js';
import env from '../config/env.js';
import { getState, drainPositions, drainArrivals } from './processor.js';
import { drainAlerts } from './alerts.js';

let stateTimer = null;
let historyTimer = null;
let arrivalTimer = null;
let rollupTimer = null;

// Track pending arrival counts for hourly rollup $inc
// key: `${stopId}:${routeId}:${dayType}:${hour}` -> { n, sumDelayS, sumHeadwayS, minHeadwayS, maxHeadwayS }
const pendingRollups = new Map();

/**
 * Flush live bus_state to MongoDB via bulkWrite upserts every 10s.
 */
export async function flushBusState() {
  if (!isDBConnected()) return;
  try {
    const db = getDB();
    const states = getState();
    if (!states || states.length === 0) return;

    const ops = states.map(s => ({
      updateOne: {
        filter: { _id: s._id },
        update: {
          $set: {
            loc: s.loc,
            speed: s.speed,
            heading: s.heading,
            progressM: s.progressM,
            nextStopId: s.nextStopId,
            occ: s.occ,
            delayS: s.delayS,
            emaSpeed: s.emaSpeed,
            seq: s.seq,
            ts: new Date(s.ts),
            tripId: s.tripId,
            routeId: s.routeId,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      const res = await db.collection('bus_state').bulkWrite(ops, { ordered: false });
      // console.log(`[persistence] Flushed ${ops.length} bus states`);
    }
  } catch (err) {
    console.error('[persistence] Error in flushBusState:', err.message);
  }
}

/**
 * Flush sampled position history to MongoDB (time-series) every 30s.
 */
export async function flushPositions() {
  if (!isDBConnected()) return;
  try {
    const db = getDB();
    const positions = drainPositions();
    if (!positions || positions.length === 0) return;

    await db.collection('positions').insertMany(positions, { ordered: false });
    // console.log(`[persistence] Flushed ${positions.length} position records`);
  } catch (err) {
    console.error('[persistence] Error in flushPositions:', err.message);
  }
}

/**
 * Flush detected stop arrivals to MongoDB every 5s.
 */
export async function flushArrivals() {
  if (!isDBConnected()) return;
  try {
    const db = getDB();
    const arrivals = drainArrivals();
    if (!arrivals || arrivals.length === 0) return;

    // Buffer for hourly rollup stats
    for (const arr of arrivals) {
      const dt = new Date(arr.ts);
      const day = dt.getDay();
      const dayType = (day === 0 || day === 6) ? 'WEEKEND' : 'WEEKDAY';
      const hour = dt.getHours();
      const key = `${arr.stopId}:${arr.routeId}:${dayType}:${hour}`;

      const existing = pendingRollups.get(key) || {
        stopId: arr.stopId,
        routeId: arr.routeId,
        dayType,
        hour,
        n: 0,
        sumHeadwayS: 0,
        sumDelayS: 0,
        minHeadwayS: arr.headwayS || 300,
        maxHeadwayS: arr.headwayS || 300,
      };

      existing.n += 1;
      existing.sumDelayS += (arr.delayS || 0);
      existing.sumHeadwayS += (arr.headwayS || 0);
      if (arr.headwayS) {
        existing.minHeadwayS = Math.min(existing.minHeadwayS, arr.headwayS);
        existing.maxHeadwayS = Math.max(existing.maxHeadwayS, arr.headwayS);
      }
      pendingRollups.set(key, existing);
    }

    // Insert arrivals with duplicate error suppression (unique compound index)
    try {
      await db.collection('arrivals').insertMany(arrivals, { ordered: false });
    } catch (insertErr) {
      // Ignore duplicate key errors (code 11000)
      if (insertErr.code !== 11000 && (!insertErr.writeErrors || insertErr.writeErrors.some(e => e.code !== 11000))) {
        console.warn('[persistence] Some arrivals failed to insert:', insertErr.message);
      }
    }
  } catch (err) {
    console.error('[persistence] Error in flushArrivals:', err.message);
  }
}

/**
 * Flush hourly stats roll-ups to MongoDB every 60s using bulkWrite $inc.
 */
export async function flushHourlyStats() {
  if (!isDBConnected()) return;
  try {
    const db = getDB();
    if (pendingRollups.size === 0) return;

    const ops = [];
    for (const [_, rollup] of pendingRollups.entries()) {
      ops.push({
        updateOne: {
          filter: {
            stopId: rollup.stopId,
            routeId: rollup.routeId,
            dayType: rollup.dayType,
            hour: rollup.hour,
          },
          update: {
            $inc: {
              n: rollup.n,
              sumHeadwayS: rollup.sumHeadwayS,
              sumDelayS: rollup.sumDelayS,
            },
            $min: { minHeadwayS: rollup.minHeadwayS },
            $max: { maxHeadwayS: rollup.maxHeadwayS },
          },
          upsert: true,
        },
      });
    }

    pendingRollups.clear();

    if (ops.length > 0) {
      await db.collection('stop_hourly_stats').bulkWrite(ops, { ordered: false });
      // console.log(`[persistence] Flushed ${ops.length} hourly rollups`);
    }
  } catch (err) {
    console.error('[persistence] Error in flushHourlyStats:', err.message);
  }
}

/**
 * Flush alerts to MongoDB.
 */
export async function flushAlerts() {
  if (!isDBConnected()) return;
  try {
    const db = getDB();
    const alerts = drainAlerts();
    if (!alerts || alerts.length === 0) return;

    await db.collection('alerts').insertMany(alerts, { ordered: false });
  } catch (err) {
    console.error('[persistence] Error in flushAlerts:', err.message);
  }
}

/**
 * Start all persistence timers.
 */
export function startPersistence() {
  stopPersistence();

  stateTimer = setInterval(flushBusState, env.STATE_FLUSH_MS);
  historyTimer = setInterval(flushPositions, env.HISTORY_FLUSH_MS);
  arrivalTimer = setInterval(() => {
    flushArrivals();
    flushAlerts();
  }, env.ARRIVAL_FLUSH_MS);
  rollupTimer = setInterval(flushHourlyStats, env.ROLLUP_FLUSH_MS);

  console.log('[persistence] Persistence timers started');
}

/**
 * Stop all persistence timers.
 */
export function stopPersistence() {
  if (stateTimer) clearInterval(stateTimer);
  if (historyTimer) clearInterval(historyTimer);
  if (arrivalTimer) clearInterval(arrivalTimer);
  if (rollupTimer) clearInterval(rollupTimer);

  stateTimer = null;
  historyTimer = null;
  arrivalTimer = null;
  rollupTimer = null;
}
