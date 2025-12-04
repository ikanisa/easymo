import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rankDrivers, DriverCandidate } from '../src/mobility-ranking';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('Mobility Ranking', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  });

  describe('rankDrivers', () => {
    it('should rank drivers by score descending', async () => {
      const candidates: DriverCandidate[] = [
        {
          trip_id: '1',
          user_id: 'user-1',
          vehicle_type: 'moto',
          distance_km: 5.0,
          location_age_minutes: 10,
          created_at: new Date().toISOString(),
        },
        {
          trip_id: '2',
          user_id: 'user-2',
          vehicle_type: 'moto',
          distance_km: 1.5,
          location_age_minutes: 3,
          created_at: new Date().toISOString(),
        },
      ];

      const result = await rankDrivers(supabase, { candidates, strategy: 'balanced' });

      expect(result.drivers).toHaveLength(2);
      expect(result.drivers[0].rank).toBe(1);
      expect(result.drivers[1].rank).toBe(2);
      // Closer driver should rank higher (due to distance bonus)
      expect(result.drivers[0].user_id).toBe('user-2');
    });

    it('should apply limit correctly', async () => {
      const candidates: DriverCandidate[] = [
        { trip_id: '1', user_id: 'user-1', vehicle_type: 'moto', distance_km: 1, location_age_minutes: 5, created_at: new Date().toISOString() },
        { trip_id: '2', user_id: 'user-2', vehicle_type: 'moto', distance_km: 2, location_age_minutes: 5, created_at: new Date().toISOString() },
        { trip_id: '3', user_id: 'user-3', vehicle_type: 'moto', distance_km: 3, location_age_minutes: 5, created_at: new Date().toISOString() },
      ];

      const result = await rankDrivers(supabase, { candidates, limit: 2 });

      expect(result.drivers).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should handle empty candidates gracefully', async () => {
      const result = await rankDrivers(supabase, { candidates: [] });

      expect(result.drivers).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should use balanced strategy by default', async () => {
      const candidates: DriverCandidate[] = [
        { trip_id: '1', user_id: 'user-1', vehicle_type: 'moto', distance_km: 5, location_age_minutes: 10, created_at: new Date().toISOString() },
      ];

      const result = await rankDrivers(supabase, { candidates });

      expect(result.strategy).toBe('balanced');
    });

    it('should respect quality strategy', async () => {
      const candidates: DriverCandidate[] = [
        { trip_id: '1', user_id: 'user-1', vehicle_type: 'moto', distance_km: 5, location_age_minutes: 10, created_at: new Date().toISOString() },
      ];

      const result = await rankDrivers(supabase, { candidates, strategy: 'quality' });

      expect(result.strategy).toBe('quality');
      expect(result.drivers[0].score).toBeGreaterThan(0);
      expect(result.drivers[0].score).toBeLessThanOrEqual(1);
    });

    it('should calculate distance bonus correctly', async () => {
      const nearCandidate: DriverCandidate[] = [
        { trip_id: '1', user_id: 'user-1', vehicle_type: 'moto', distance_km: 1.0, location_age_minutes: 20, created_at: new Date().toISOString() },
      ];

      const farCandidate: DriverCandidate[] = [
        { trip_id: '2', user_id: 'user-2', vehicle_type: 'moto', distance_km: 15.0, location_age_minutes: 20, created_at: new Date().toISOString() },
      ];

      const nearResult = await rankDrivers(supabase, { candidates: nearCandidate });
      const farResult = await rankDrivers(supabase, { candidates: farCandidate });

      // Near driver should have higher score due to distance bonus
      expect(nearResult.drivers[0].score).toBeGreaterThan(farResult.drivers[0].score);
    });

    it('should calculate recency bonus correctly', async () => {
      const recentCandidate: DriverCandidate[] = [
        { trip_id: '1', user_id: 'user-1', vehicle_type: 'moto', distance_km: 5.0, location_age_minutes: 2, created_at: new Date().toISOString() },
      ];

      const oldCandidate: DriverCandidate[] = [
        { trip_id: '2', user_id: 'user-2', vehicle_type: 'moto', distance_km: 5.0, location_age_minutes: 35, created_at: new Date().toISOString() },
      ];

      const recentResult = await rankDrivers(supabase, { candidates: recentCandidate });
      const oldResult = await rankDrivers(supabase, { candidates: oldCandidate });

      // Recent driver should have higher score due to recency bonus
      expect(recentResult.drivers[0].score).toBeGreaterThan(oldResult.drivers[0].score);
    });

    it('should cap final score at 1.0', async () => {
      const candidates: DriverCandidate[] = [
        { trip_id: '1', user_id: 'user-1', vehicle_type: 'moto', distance_km: 0.5, location_age_minutes: 1, created_at: new Date().toISOString() },
      ];

      const result = await rankDrivers(supabase, { candidates });

      expect(result.drivers[0].score).toBeLessThanOrEqual(1.0);
    });

    it('should assign correct metrics', async () => {
      const candidates: DriverCandidate[] = [
        { trip_id: '1', user_id: 'user-1', vehicle_type: 'moto', distance_km: 5, location_age_minutes: 10, created_at: new Date().toISOString() },
      ];

      const result = await rankDrivers(supabase, { candidates });

      expect(result.drivers[0].metrics).toBeDefined();
      expect(result.drivers[0].metrics.acceptance_rate).toBeGreaterThanOrEqual(0);
      expect(result.drivers[0].metrics.completion_rate).toBeGreaterThanOrEqual(0);
      expect(result.drivers[0].metrics.total_trips).toBeGreaterThanOrEqual(0);
    });
  });
});
