import { Router } from 'express';
import { getDB } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getBusState, getBusMeta } from '../services/processor.js';

const router = Router();

// GET /api/buses/:id (registration + latest state)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const busId = req.params.id;

    // Check in-memory metadata and state first (fast path)
    let meta = getBusMeta(busId);
    let state = getBusState(busId);

    // If not in memory, query DB
    if (!meta) {
      const db = getDB();
      meta = await db.collection('buses').findOne({ _id: busId });
    }

    if (!state) {
      const db = getDB();
      state = await db.collection('bus_state').findOne({ _id: busId });
    }

    if (!meta && !state) {
      return res.status(404).json({ error: `Bus ${busId} not found` });
    }

    return res.json({
      registration: meta || { _id: busId },
      state: state || null,
    });
  } catch (err) {
    console.error('[buses] Error fetching bus:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/buses/:id/weekly-history
router.get('/:id/weekly-history', requireAuth, async (req, res) => {
  try {
    const busId = req.params.id;
    let meta = getBusMeta(busId);
    if (!meta) {
      const db = getDB();
      meta = await db.collection('buses').findOne({ _id: busId });
    }

    if (!meta) {
      return res.status(404).json({ error: `Bus ${busId} not found` });
    }

    const db = getDB();
    const route = await db.collection('routes').findOne({ _id: meta.routeId });
    if (!route || !Array.isArray(route.stops)) {
      return res.status(404).json({ error: `Route ${meta.routeId} not found for bus` });
    }

    // Load stop names
    const stopIds = route.stops.map((s) => s.stopId);
    const stopsList = await db.collection('stops').find({ _id: { $in: stopIds } }).toArray();
    const stopNameMap = new Map(stopsList.map((s) => [s._id, s.name]));

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const baseHour = 8; // 8:00 AM trip
    const baseMinute = 15;

    // Build weekly analysis per stop
    const stopsAnalysis = route.stops.map((stopItem) => {
      const stopName = stopNameMap.get(stopItem.stopId) || `Stop ${stopItem.stopId}`;
      const cumulativeTravelMin = Math.round(stopItem.offsetM / (22 * (1000 / 60))) + (stopItem.seqNo - 1) * 0.5;

      const dailyArrivals = days.map((day, dayIndex) => {
        // Deterministic daily variation for realistic demo data
        const jitterMin = Math.round(((dayIndex * 3 + stopItem.seqNo * 7) % 7) - 2);
        const totalMinutesFromStart = Math.round(baseMinute + cumulativeTravelMin + jitterMin);
        const arrivalHour = (baseHour + Math.floor(totalMinutesFromStart / 60)) % 24;
        const arrivalMin = totalMinutesFromStart % 60;
        const formattedTime = `${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')} AM`;

        const delayMinutes = Math.max(-1, jitterMin);
        return {
          day,
          dayIndex,
          arrivalTime: formattedTime,
          delayMinutes,
          status: delayMinutes <= 1 ? 'On Time' : delayMinutes <= 3 ? 'Slight Delay' : 'Delayed',
          dwellSeconds: 20 + ((stopItem.seqNo * 3) % 15),
          headwayMinutes: 12 + (dayIndex % 4),
        };
      });

      return {
        seqNo: stopItem.seqNo,
        stopId: stopItem.stopId,
        stopName,
        offsetM: stopItem.offsetM,
        dailyArrivals,
        avgDelayMin: (dailyArrivals.reduce((acc, d) => acc + d.delayMinutes, 0) / days.length).toFixed(1),
        onTimeRate: Math.round(
          (dailyArrivals.filter((d) => d.delayMinutes <= 2).length / days.length) * 100
        ),
      };
    });

    return res.json({
      busId,
      regNo: meta.regNo,
      routeId: meta.routeId,
      routeNo: route.routeNo,
      origin: route.origin,
      destination: route.destination,
      totalStops: route.stops.length,
      lengthM: route.lengthM,
      stopsAnalysis,
    });
  } catch (err) {
    console.error('[buses] Error fetching weekly history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/buses/:id/history?from=&to=&limit=
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    const busId = req.params.id;
    const { from, to, limit = 500 } = req.query;
    const db = getDB();

    const query = {
      'meta.busId': busId,
    };

    if (from || to) {
      query.ts = {};
      if (from) query.ts.$gte = new Date(from);
      if (to) query.ts.$lte = new Date(to);
    }

    const maxLimit = Math.min(1000, parseInt(limit, 10) || 500);

    const positions = await db
      .collection('positions')
      .find(query)
      .sort({ ts: 1 })
      .limit(maxLimit)
      .toArray();

    return res.json({
      busId,
      count: positions.length,
      history: positions,
    });
  } catch (err) {
    console.error('[buses] Error fetching bus history:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
