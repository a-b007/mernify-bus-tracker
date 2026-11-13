import env from '../config/env.js';

/**
 * Validates x-api-key header against process.env.INGEST_API_KEY.
 */
export function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== env.INGEST_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}
