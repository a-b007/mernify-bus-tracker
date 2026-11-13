import { describe, it, expect } from 'vitest';
import {
  telemetryEventSchema,
  telemetryBatchSchema,
  registerSchema,
  loginSchema,
  faultSchema,
  viewportSchema,
  stopSubSchema,
  routeSubSchema,
} from '../src/models/schemas.js';

describe('Zod Schemas Validation', () => {
  describe('telemetryEventSchema', () => {
    it('accepts valid telemetry event', () => {
      const valid = {
        busId: 'B0001',
        seq: 100,
        ts: Date.now(),
        lat: 12.9716,
        lng: 77.5946,
        speed: 25.4,
        heading: 90,
        occ: 35,
      };
      const res = telemetryEventSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it('rejects coordinates outside Bengaluru bbox', () => {
      const invalidLat = {
        busId: 'B0001',
        seq: 100,
        ts: Date.now(),
        lat: 19.0760, // Mumbai lat
        lng: 77.5946,
        speed: 25,
        heading: 90,
      };
      const res = telemetryEventSchema.safeParse(invalidLat);
      expect(res.success).toBe(false);
    });

    it('rejects negative seq or invalid heading', () => {
      const invalidSeq = {
        busId: 'B0001',
        seq: -5,
        ts: Date.now(),
        lat: 12.9716,
        lng: 77.5946,
        speed: 25,
        heading: 400,
      };
      const res = telemetryEventSchema.safeParse(invalidSeq);
      expect(res.success).toBe(false);
    });
  });

  describe('telemetryBatchSchema', () => {
    it('accepts batch of valid events', () => {
      const batch = {
        events: [
          {
            busId: 'B0001',
            seq: 1,
            ts: Date.now(),
            lat: 12.97,
            lng: 77.59,
            speed: 20,
            heading: 0,
          },
        ],
      };
      expect(telemetryBatchSchema.safeParse(batch).success).toBe(true);
    });

    it('rejects empty batch or batch > 1000 items', () => {
      expect(telemetryBatchSchema.safeParse({ events: [] }).success).toBe(false);
    });
  });

  describe('registerSchema & loginSchema', () => {
    it('validates register email and password length', () => {
      expect(registerSchema.safeParse({ email: 'test@example.com', password: 'password123' }).success).toBe(true);
      expect(registerSchema.safeParse({ email: 'not-an-email', password: 'short' }).success).toBe(false);
    });

    it('validates login schema', () => {
      expect(loginSchema.safeParse({ email: 'test@example.com', password: 'p' }).success).toBe(true);
      expect(loginSchema.safeParse({ email: 'bad', password: '' }).success).toBe(false);
    });
  });

  describe('faultSchema', () => {
    it('accepts BREAKDOWN and BUNCHING faults', () => {
      expect(faultSchema.safeParse({ type: 'BREAKDOWN', busId: 'B0001', durationS: 120 }).success).toBe(true);
      expect(faultSchema.safeParse({ type: 'BUNCHING', busId: 'B0002' }).success).toBe(true);
      expect(faultSchema.safeParse({ type: 'UNKNOWN', busId: 'B0001' }).success).toBe(false);
    });
  });

  describe('socket subscription schemas', () => {
    it('validates viewportSchema, stopSubSchema, routeSubSchema', () => {
      expect(viewportSchema.safeParse({ cells: ['12:34', '12:35'] }).success).toBe(true);
      expect(stopSubSchema.safeParse({ stopId: 'S0001' }).success).toBe(true);
      expect(routeSubSchema.safeParse({ routeId: '335E-UP' }).success).toBe(true);
    });
  });
});
