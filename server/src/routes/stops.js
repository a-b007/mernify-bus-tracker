import { Router } from 'express';
import { getDB } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getStop, getAllStops } from '../services/processor.js';

const router = Router();

// GET /api/stops?bbox=minLng,minLat,maxLng,maxLat
router.get('/', requireAuth, async (req, res) => {
  try {
    const { bbox } = req.query;

    if (!bbox) {
      // Return all stops from in-memory cache or DB
      const inMemStops = getAllStops();
      if (inMemStops.length > 0) {
        return res.json(inMemStops);
      }
      const db = getDB();
      const dbStops = await db.collection('stops').find().toArray();
      return res.json(dbStops);
    }

    const parts = bbox.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return res.status(400).json({ error: 'Invalid bbox format. Expected minLng,minLat,maxLng,maxLat' });
    }

    const [minLng, minLat, maxLng, maxLat] = parts;
    const db = getDB();

    // Geospatial query with $geoWithin
    const stops = await db.collection('stops').find({
      loc: {
        $geoWithin: {
          $box: [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
        },
      },
    }).toArray();

    return res.json(stops);
  } catch (err) {
    console.error('[stops] Error fetching stops:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stops/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const stopId = req.params.id;
    let stop = getStop(stopId);

    if (!stop) {
      const db = getDB();
      stop = await db.collection('stops').findOne({ _id: stopId });
    }

    if (!stop) {
      return res.status(404).json({ error: `Stop ${stopId} not found` });
    }

    return res.json(stop);
  } catch (err) {
    console.error('[stops] Error fetching stop:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stops/:id/eta
router.get('/:id/eta', requireAuth, async (req, res) => {
  try {
    const stopId = req.params.id;
    
    // Check if analytics ETA service exists or compute nominal fallback
    let etaItems = [];
    try {
      const etaService = req.app.locals?.etaService;
      if (etaService && typeof etaService.computeETAs === 'function') {
        etaItems = etaService.computeETAs(stopId);
      } else {
        const etaModule = await import('../services/eta.js');
        if (etaModule.computeStopETA) {
          etaItems = await etaModule.computeStopETA(stopId);
        } else if (etaModule.ETAService) {
          const serviceInstance = new etaModule.ETAService();
          etaItems = serviceInstance.computeETAs(stopId);
        }
      }
    } catch (e) {
      // Fallback if eta service not created yet by analytics agent
      etaItems = [];
    }

    return res.json({
      stopId,
      ts: Date.now(),
      items: etaItems || [],
    });
  } catch (err) {
    console.error('[stops] Error fetching ETA:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stops/:id/arrivals?from=&to=&routeId=
router.get('/:id/arrivals', requireAuth, async (req, res) => {
  try {
    const stopId = req.params.id;
    const { from, to, routeId, limit = 100 } = req.query;
    const db = getDB();

    const query = { stopId };
    if (routeId) query.routeId = routeId;

    if (from || to) {
      query.ts = {};
      if (from) query.ts.$gte = new Date(from);
      if (to) query.ts.$lte = new Date(to);
    }

    const arrivals = await db
      .collection('arrivals')
      .find(query)
      .sort({ ts: -1 })
      .limit(Math.min(500, parseInt(limit, 10) || 100))
      .toArray();

    return res.json({
      stopId,
      count: arrivals.length,
      arrivals,
    });
  } catch (err) {
    console.error('[stops] Error fetching arrivals:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stops/:id/stats?dayType=&routeId=
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const stopId = req.params.id;
    const { dayType, routeId } = req.query;
    const db = getDB();

    const query = { stopId };
    if (dayType) query.dayType = dayType.toUpperCase();
    if (routeId) query.routeId = routeId;

    const stats = await db
      .collection('stop_hourly_stats')
      .find(query)
      .sort({ hour: 1 })
      .toArray();

    return res.json({
      stopId,
      stats,
    });
  } catch (err) {
    console.error('[stops] Error fetching stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
