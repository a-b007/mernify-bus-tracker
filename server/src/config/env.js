import 'dotenv/config';

const env = {
  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_twin',
  DB_NAME: process.env.DB_NAME || 'bus_twin',

  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // API Keys
  INGEST_API_KEY: process.env.INGEST_API_KEY || 'dev-ingest-key-change-me',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  INGEST_RATE_LIMIT_MAX: parseInt(process.env.INGEST_RATE_LIMIT_MAX || '60', 10),

  // Socket.IO
  SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',

  // Storage TTL (seconds)
  POSITIONS_TTL: parseInt(process.env.POSITIONS_TTL || '7200', 10),
  ARRIVALS_TTL: parseInt(process.env.ARRIVALS_TTL || '172800', 10),
  ALERTS_TTL: parseInt(process.env.ALERTS_TTL || '259200', 10),

  // Batched write intervals (ms)
  STATE_FLUSH_MS: parseInt(process.env.STATE_FLUSH_MS || '10000', 10),
  HISTORY_FLUSH_MS: parseInt(process.env.HISTORY_FLUSH_MS || '30000', 10),
  ARRIVAL_FLUSH_MS: parseInt(process.env.ARRIVAL_FLUSH_MS || '5000', 10),
  ROLLUP_FLUSH_MS: parseInt(process.env.ROLLUP_FLUSH_MS || '60000', 10),

  // ETA
  ETA_INTERVAL_MS: parseInt(process.env.ETA_INTERVAL_MS || '5000', 10),

  // Simulator
  FLEET_SIZE: parseInt(process.env.FLEET_SIZE || '600', 10),
  TICK_MS: parseInt(process.env.TICK_MS || '1000', 10),
  SEND_INTERVAL_MS: parseInt(process.env.SEND_INTERVAL_MS || '2000', 10),
  TIME_SCALE: parseFloat(process.env.TIME_SCALE || '1'),
  INGEST_URL: process.env.INGEST_URL || 'http://localhost:3001/api/ingest/batch',
};

export default env;
