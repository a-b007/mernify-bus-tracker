import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * General rate limiter: 100 requests per minute.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

/**
 * Ingest rate limiter: 60 requests per minute per API key.
 */
export const ingestLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.INGEST_RATE_LIMIT_MAX,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Ingest rate limit exceeded' },
});

/**
 * Login rate limiter: 10 requests per minute per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});
