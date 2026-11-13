import { Router } from 'express';
import { getDB } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getAllRoutes, getRoute } from '../services/processor.js';

const router = Router();

// GET /api/routes (All route metadata)
router.get('/', requireAuth, async (req, res) => {
  try {
    const memRoutes = getAllRoutes();
    if (memRoutes.length > 0) {
      return res.json(memRoutes);
    }

    const db = getDB();
    const routes = await db.collection('routes').find().toArray();
    return res.json(routes);
  } catch (err) {
    console.error('[routes] Error fetching routes:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/routes/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const routeId = req.params.id;
    let route = getRoute(routeId);

    if (!route) {
      const db = getDB();
      route = await db.collection('routes').findOne({ _id: routeId });
    }

    if (!route) {
      return res.status(404).json({ error: `Route ${routeId} not found` });
    }

    return res.json(route);
  } catch (err) {
    console.error('[routes] Error fetching route:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
