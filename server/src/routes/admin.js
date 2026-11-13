import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { faultSchema } from '../models/schemas.js';
import { getBusState } from '../services/processor.js';
import { createAlert } from '../services/alerts.js';
import { broadcastAlert } from '../socket/index.js';

const router = Router();

// POST /api/admin/sim/fault
router.post(
  '/sim/fault',
  requireAuth,
  requireAdmin,
  validate(faultSchema),
  async (req, res) => {
    try {
      const { type, busId, durationS = 300 } = req.body;
      const busState = getBusState(busId);

      // Create alert for admin fault injection
      const alert = createAlert(
        type,
        busId,
        busState?.routeId || 'UNKNOWN',
        {
          injectedBy: req.user.email,
          durationS,
          reason: `Admin fault injection: ${type}`,
          location: busState?.loc?.coordinates || [77.57, 12.97],
        }
      );

      // Broadcast immediately to admins & route listeners
      broadcastAlert(alert);

      return res.json({
        status: 'fault_injected',
        fault: {
          type,
          busId,
          durationS,
          alert,
        },
      });
    } catch (err) {
      console.error('[admin] Fault injection error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
