import { Router } from 'express';
import {
  getArrivalTimeline,
  getHeadwayHistogram,
  getHourlyStats,
  getOnTimePercentage,
  getRoutePerformance,
} from '../services/analytics.js';

let defaultAuth = null;
try {
  const authModule = await import('../middleware/auth.js');
  defaultAuth = authModule.requireAuth;
} catch {
  // Fallback pass-through if auth middleware not yet loaded
  defaultAuth = (req, res, next) => next();
}

/**
 * Factory to create analytics router with injected dependencies.
 *
 * @param {object} [deps]
 * @param {import('mongodb').Db} [deps.db]
 * @param {import('../services/eta.js').ETAService} [deps.etaService]
 * @param {Function} [deps.requireAuth]
 * @returns {import('express').Router}
 */
export function createAnalyticsRouter(deps = {}) {
  const router = Router();
  const requireAuth = deps.requireAuth || defaultAuth || ((req, res, next) => next());

  const getDb = (req) => deps.db || req.app?.locals?.db || req.app?.get?.('db');
  const getEtaService = (req) => deps.etaService || req.app?.locals?.etaService || req.app?.get?.('etaService');

  /**
   * GET /stops/:id/eta
   * Live ETA list for a stop (top 3 nearest buses)
   */
  router.get('/stops/:id/eta', requireAuth, async (req, res) => {
    try {
      const stopId = req.params.id;
      const etaService = getEtaService(req);

      if (!etaService) {
        return res.status(503).json({ error: 'ETA service not initialized' });
      }

      const etas = etaService.computeETAs(stopId);
      res.json({ stopId, etas });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to compute ETAs' });
    }
  });

  /**
   * GET /stops/:id/arrivals?from&to&routeId
   * Raw arrival events in time range
   */
  router.get('/stops/:id/arrivals', requireAuth, async (req, res) => {
    try {
      const stopId = req.params.id;
      const { from, to, routeId } = req.query;

      if (!from || !to) {
        return res.status(400).json({ error: 'Missing required query params: from, to' });
      }

      const db = getDb(req);
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }

      const arrivals = await getArrivalTimeline(db, stopId, from, to, routeId);
      res.json(arrivals);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch arrivals' });
    }
  });

  /**
   * GET /stops/:id/stats?dayType&routeId
   * Hourly roll-ups for a stop
   */
  router.get('/stops/:id/stats', requireAuth, async (req, res) => {
    try {
      const stopId = req.params.id;
      const { dayType, routeId } = req.query;

      const db = getDb(req);
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }

      const stats = await getHourlyStats(db, stopId, dayType, routeId);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch hourly stats' });
    }
  });

  /**
   * GET /stops/:id/headway?from&to&routeId
   * Headway distribution histogram
   */
  router.get('/stops/:id/headway', requireAuth, async (req, res) => {
    try {
      const stopId = req.params.id;
      const { from, to, routeId } = req.query;

      if (!from || !to) {
        return res.status(400).json({ error: 'Missing required query params: from, to' });
      }

      const db = getDb(req);
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }

      const histogram = await getHeadwayHistogram(db, stopId, from, to, routeId);
      res.json(histogram);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch headway histogram' });
    }
  });

  /**
   * GET /stops/:id/ontime?routeId
   * On-time arrival percentage
   */
  router.get('/stops/:id/ontime', requireAuth, async (req, res) => {
    try {
      const stopId = req.params.id;
      const { routeId } = req.query;

      const db = getDb(req);
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }

      const onTime = await getOnTimePercentage(db, stopId, routeId);
      res.json(onTime);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to compute on-time percentage' });
    }
  });

  /**
   * GET /routes/:id/perf
   * Route performance summary across stops
   */
  router.get('/routes/:id/perf', requireAuth, async (req, res) => {
    try {
      const routeId = req.params.id;
      const db = getDb(req);
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }

      const perf = await getRoutePerformance(db, routeId);
      res.json(perf);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch route performance' });
    }
  });

  return router;
}

// Default pre-instantiated router that resolves dependencies from req.app.locals
export const router = createAnalyticsRouter();
export default router;
