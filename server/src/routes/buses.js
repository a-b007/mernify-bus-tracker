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
