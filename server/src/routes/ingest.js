import { Router } from 'express';
import { requireApiKey } from '../middleware/apiKey.js';
import { ingestLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { telemetryBatchSchema } from '../models/schemas.js';
import { processBatch } from '../services/processor.js';
import { broadcastAlert } from '../socket/index.js';

const router = Router();

// POST /api/ingest/batch
router.post(
  '/batch',
  requireApiKey,
  ingestLimiter,
  validate(telemetryBatchSchema),
  (req, res) => {
    try {
      const { events } = req.body;
      const result = processBatch(events);

      // Broadcast any new alerts
      if (result.newAlerts && result.newAlerts.length > 0) {
        for (const alert of result.newAlerts) {
          broadcastAlert(alert);
        }
      }

      return res.status(200).json({
        status: 'ok',
        processed: result.processedCount,
        rejected: result.rejectedCount,
        rejectedDetails: result.rejected.length > 0 ? result.rejected : undefined,
      });
    } catch (err) {
      console.error('[ingest] Ingestion error:', err);
      return res.status(500).json({ error: 'Ingestion failure' });
    }
  }
);

export default router;
