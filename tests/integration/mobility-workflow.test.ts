/**
 * Integration Tests - Mobility V2
 * 
 * Full end-to-end workflow testing:
 * 1. Passenger creates trip
 * 2. System finds nearby drivers
 * 3. Ranks drivers by quality
 * 4. Creates match
 * 5. Updates trip status
 * 
 * Prerequisites:
 * - All services running (matching, ranking, orchestrator, tracking)
 * - Database migrations applied
 * - Test data seeded
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

// Service URLs
const SERVICES = {
  matching: process.env.MATCHING_SERVICE_URL || 'http://localhost:4700',
  ranking: process.env.RANKING_SERVICE_URL || 'http://localhost:4500',
  orchestrator: process.env.ORCHESTRATOR_SERVICE_URL || 'http://localhost:4600',
  tracking: process.env.TRACKING_SERVICE_URL || 'http://localhost:4800',
};

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key',
  timeout: 10000, // 10 seconds
};

let supabase: SupabaseClient;

// Test data
const TEST_USERS = {
  passenger: {
    id: '00000000-0000-0000-0000-000000000001',
    phone: '+250788000001',
  },
  driver1: {
    id: '00000000-0000-0000-0000-000000000002',
    phone: '+250788000002',
  },
  driver2: {
    id: '00000000-0000-0000-0000-000000000003',
    phone: '+250788000003',
  },
};

describe('Mobility V2 Integration Tests', () => {
  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify services are running
    const healthChecks = await Promise.all([
      axios.get(`${SERVICES.matching}/health`).catch(() => null),
      axios.get(`${SERVICES.ranking}/health`).catch(() => null),
      axios.get(`${SERVICES.orchestrator}/health`).catch(() => null),
      axios.get(`${SERVICES.tracking}/health`).catch(() => null),
    ]);

    const allHealthy = healthChecks.every(r => r?.status === 200);
    if (!allHealthy) {
      console.warn('⚠️  Some services not running. Tests may fail.');
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('mobility_trip_matches').delete().in('driver_user_id', [
      TEST_USERS.driver1.id,
      TEST_USERS.driver2.id,
    ]);

    await supabase.from('mobility_trips').delete().in('creator_user_id', [
      TEST_USERS.passenger.id,
      TEST_USERS.driver1.id,
      TEST_USERS.driver2.id,
    ]);
  });

  describe('Full Workflow: Passenger Search → Match → Accept', () => {
    let passengerTripId: string;
    let driverTripIds: string[] = [];

    it('should create passenger trip', async () => {
      const { data, error } = await supabase
        .from('mobility_trips')
        .insert({
          creator_user_id: TEST_USERS.passenger.id,
          role: 'passenger',
          vehicle_type: 'moto',
          pickup_lat: -1.9500,
          pickup_lng: 30.0600,
          pickup_text: 'Kigali City Center',
          dropoff_lat: -1.9700,
          dropoff_lng: 30.1000,
          dropoff_text: 'Nyamirambo',
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBeDefined();

      passengerTripId = data!.id;
    });

    it('should create driver trips nearby', async () => {
      // Driver 1: Close (1km away)
      const { data: driver1Trip } = await supabase
        .from('mobility_trips')
        .insert({
          creator_user_id: TEST_USERS.driver1.id,
          role: 'driver',
          vehicle_type: 'moto',
          pickup_lat: -1.9550, // ~500m from passenger
          pickup_lng: 30.0650,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        })
        .select()
        .single();

      // Driver 2: Far (10km away)
      const { data: driver2Trip } = await supabase
        .from('mobility_trips')
        .insert({
          creator_user_id: TEST_USERS.driver2.id,
          role: 'driver',
          vehicle_type: 'moto',
          pickup_lat: -1.8500, // ~10km from passenger
          pickup_lng: 30.0600,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        })
        .select()
        .single();

      expect(driver1Trip).toBeDefined();
      expect(driver2Trip).toBeDefined();

      driverTripIds = [driver1Trip!.id, driver2Trip!.id];
    });

    it('should find nearby drivers via matching service', async () => {
      const response = await axios.post(`${SERVICES.matching}/matches`, {
        tripId: passengerTripId,
        role: 'passenger',
        vehicleType: 'moto',
        radiusKm: 15,
        limit: 20,
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.candidates).toBeDefined();
      expect(response.data.count).toBeGreaterThan(0);

      // Should find at least driver 1 (close)
      const candidateIds = response.data.candidates.map((c: any) => c.trip_id);
      expect(candidateIds).toContain(driverTripIds[0]);
    });

    it('should rank drivers via ranking service', async () => {
      // First get candidates
      const matchResponse = await axios.post(`${SERVICES.matching}/matches`, {
        tripId: passengerTripId,
        role: 'passenger',
        vehicleType: 'moto',
        radiusKm: 15,
        limit: 20,
      });

      const candidates = matchResponse.data.candidates;

      // Then rank them
      const rankResponse = await axios.post(`${SERVICES.ranking}/ranking/drivers`, {
        candidates,
        strategy: 'balanced',
        limit: 5,
      });

      expect(rankResponse.status).toBe(200);
      expect(rankResponse.data.success).toBe(true);
      expect(rankResponse.data.drivers).toBeDefined();
      expect(rankResponse.data.drivers.length).toBeGreaterThan(0);

      // Drivers should be ranked (rank 1, 2, 3...)
      const ranks = rankResponse.data.drivers.map((d: any) => d.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

      // Scores should be descending
      const scores = rankResponse.data.drivers.map((d: any) => d.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));

      // Top driver should be closer one (has distance bonus)
      expect(rankResponse.data.drivers[0].trip_id).toBe(driverTripIds[0]);
    });

    it('should orchestrate full find-drivers workflow', async () => {
      const response = await axios.post(`${SERVICES.orchestrator}/workflows/find-drivers`, {
        userId: TEST_USERS.passenger.id,
        passengerTripId,
        vehicleType: 'moto',
        radiusKm: 15,
        limit: 5,
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.workflow).toBe('find-drivers');
      expect(response.data.drivers).toBeDefined();
      expect(response.data.count).toBeGreaterThan(0);

      // Should have scored drivers
      expect(response.data.drivers[0].score).toBeDefined();
      expect(response.data.drivers[0].rank).toBe(1);
    });

    it('should create match via orchestrator', async () => {
      const response = await axios.post(`${SERVICES.orchestrator}/workflows/accept-match`, {
        driverTripId: driverTripIds[0],
        passengerTripId,
        driverUserId: TEST_USERS.driver1.id,
        passengerUserId: TEST_USERS.passenger.id,
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.match).toBeDefined();
      expect(response.data.match.id).toBeDefined();
      expect(response.data.match.status).toBe('pending');
    });

    it('should update trip statuses to matched', async () => {
      const { data: passengerTrip } = await supabase
        .from('mobility_trips')
        .select('status')
        .eq('id', passengerTripId)
        .single();

      const { data: driverTrip } = await supabase
        .from('mobility_trips')
        .select('status')
        .eq('id', driverTripIds[0])
        .single();

      expect(passengerTrip?.status).toBe('matched');
      expect(driverTrip?.status).toBe('matched');
    });

    it('should update location via tracking service', async () => {
      const response = await axios.post(`${SERVICES.tracking}/locations/update`, {
        tripId: driverTripIds[0],
        lat: -1.9520,
        lng: 30.0620,
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.lat).toBe(-1.9520);
      expect(response.data.lng).toBe(30.0620);
    });
  });

  describe('Service Health Checks', () => {
    it('should have matching service healthy', async () => {
      const response = await axios.get(`${SERVICES.matching}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });

    it('should have ranking service healthy', async () => {
      const response = await axios.get(`${SERVICES.ranking}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toMatch(/healthy|ok/);
    });

    it('should have orchestrator service healthy', async () => {
      const response = await axios.get(`${SERVICES.orchestrator}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });

    it('should have tracking service healthy', async () => {
      const response = await axios.get(`${SERVICES.tracking}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle non-existent trip gracefully', async () => {
      const response = await axios.post(`${SERVICES.matching}/matches`, {
        tripId: '00000000-0000-0000-0000-999999999999',
        role: 'passenger',
        vehicleType: 'moto',
      }).catch(e => e.response);

      // Should return empty candidates, not error
      expect(response.data.success).toBe(true);
      expect(response.data.candidates).toEqual([]);
    });

    it('should validate invalid coordinates', async () => {
      const response = await axios.post(`${SERVICES.tracking}/locations/update`, {
        tripId: '00000000-0000-0000-0000-000000000001',
        lat: 999, // Invalid
        lng: 30.06,
      }).catch(e => e.response);

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    it('should require all fields for match creation', async () => {
      const response = await axios.post(`${SERVICES.orchestrator}/workflows/accept-match`, {
        driverTripId: '00000000-0000-0000-0000-000000000001',
        // Missing required fields
      }).catch(e => e.response);

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should complete find-drivers workflow in <1s', async () => {
      const start = Date.now();

      await axios.post(`${SERVICES.orchestrator}/workflows/find-drivers`, {
        userId: TEST_USERS.passenger.id,
        passengerTripId: '00000000-0000-0000-0000-000000000001',
        vehicleType: 'moto',
      }).catch(() => null); // May fail if no trips, but we're testing speed

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
