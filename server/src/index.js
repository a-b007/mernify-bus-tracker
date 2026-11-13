import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import env from './config/env.js';
import { connectDB } from './config/db.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { loadStaticData } from './services/processor.js';
import { startPersistence, stopPersistence, flushBusState, flushPositions, flushArrivals, flushHourlyStats } from './services/persistence.js';
import { initSocket, closeSocket } from './socket/index.js';

// Route imports
import authRoutes from './routes/auth.js';
import ingestRoutes from './routes/ingest.js';
import busesRoutes from './routes/buses.js';
import stopsRoutes from './routes/stops.js';
import routesRoutes from './routes/routes.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: env.SOCKET_CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Apply general rate limiter to non-ingest endpoints
app.use('/api/auth', generalLimiter);
app.use('/api/buses', generalLimiter);
app.use('/api/stops', generalLimiter);
app.use('/api/routes', generalLimiter);
app.use('/api/admin', generalLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'bus-twin-server', timestamp: new Date() });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/buses', busesRoutes);
app.use('/api/stops', stopsRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/admin', adminRoutes);

// Optional: mount analytics routes if analytics-agent created them
try {
  const analyticsRoutes = await import('./routes/analytics.js');
  if (analyticsRoutes.default) {
    app.use('/api', analyticsRoutes.default);
  }
} catch (e) {
  // Not created yet or handled by stops.js
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[server] Uncaught error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const server = http.createServer(app);

/**
 * Start the server.
 */
export async function startServer() {
  try {
    // 1. Connect to MongoDB
    console.log('[server] Connecting to MongoDB...');
    try {
      await connectDB();
    } catch (dbErr) {
      console.warn('[server] Warning: MongoDB connection failed on startup. Will continue in memory mode:', dbErr.message);
    }

    // 2. Load static data into processor
    loadStaticData();

    // 3. Attach Socket.IO
    initSocket(server);

    // 4. Start persistence timers
    startPersistence();

    // 5. Listen
    return new Promise((resolve) => {
      server.listen(env.PORT, () => {
        console.log(`[server] Bengaluru Bus Twin Server running on port ${env.PORT}`);
        resolve({ server, app });
      });
    });
  } catch (err) {
    console.error('[server] Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`[server] Received ${signal}. Shutting down gracefully...`);
  stopPersistence();
  closeSocket();

  try {
    console.log('[server] Flushing remaining state to DB...');
    await Promise.allSettled([
      flushBusState(),
      flushPositions(),
      flushArrivals(),
      flushHourlyStats(),
    ]);
  } catch (e) {
    // ignore
  }

  server.close(() => {
    console.log('[server] HTTP server closed. Exiting.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server if executed directly
if (process.argv[1] && process.argv[1].endsWith('src/index.js')) {
  startServer();
}

export { app, server };
export default app;
