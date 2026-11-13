import { z } from 'zod';

// Telemetry event from a single bus
export const telemetryEventSchema = z.object({
  busId: z.string().min(1),
  seq: z.number().int().positive(),
  ts: z.number().positive(),
  lat: z.number().min(12.7).max(13.2),
  lng: z.number().min(77.3).max(77.9),
  speed: z.number().min(0).max(120),
  heading: z.number().int().min(0).max(359),
  occ: z.number().int().min(0).max(100).optional(),
});

// Batch of telemetry events
export const telemetryBatchSchema = z.object({
  events: z.array(telemetryEventSchema).min(1).max(1000),
});

// User registration
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// User login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Admin fault injection
export const faultSchema = z.object({
  type: z.enum(['BREAKDOWN', 'BUNCHING']),
  busId: z.string().min(1),
  durationS: z.number().positive().optional(),
});

// Socket viewport subscription
export const viewportSchema = z.object({
  cells: z.array(z.string()),
});

// Socket stop subscription
export const stopSubSchema = z.object({
  stopId: z.string().min(1),
});

// Socket route subscription
export const routeSubSchema = z.object({
  routeId: z.string().min(1),
});
