import { describe, it, expect, beforeEach } from 'vitest';
import { mockAdapter } from './adapter.mock';

describe('MockAdapter', () => {
  beforeEach(async () => {
    // Reset to clean state before each test
    await mockAdapter.resetMockData();
  });

  describe('Settings Management', () => {
    it('should get default settings', async () => {
      const settings = await mockAdapter.getSettings();
      expect(settings.subscription_price).toBe(5000);
      expect(settings.search_radius_km).toBe(5.0);
      expect(settings.max_results).toBe(10);
      expect(settings.momo_payee_number).toBe('0788123456');
      expect(settings.support_phone_e164).toBe('+250788123456');
    });

    it('should update settings', async () => {
      const updated = await mockAdapter.updateSettings({
        subscription_price: 6000,
        max_results: 15
      });
      expect(updated.subscription_price).toBe(6000);
      expect(updated.max_results).toBe(15);
      expect(updated.search_radius_km).toBe(5.0); // Unchanged
    });
  });

  describe('User Management', () => {
    it('should list users', async () => {
      const users = await mockAdapter.listUsers();
      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).toHaveProperty('id');
      expect(users[0]).toHaveProperty('whatsapp_number');
      expect(users[0]).toHaveProperty('ref_code');
    });

    it('should have getUsers alias', async () => {
      const users1 = await mockAdapter.listUsers();
      const users2 = await mockAdapter.getUsers();
      expect(users1).toEqual(users2);
    });
  });

  describe('Subscription Management', () => {
    it('should list subscriptions', async () => {
      const subscriptions = await mockAdapter.getSubscriptions();
      expect(subscriptions.length).toBeGreaterThan(0);
      expect(subscriptions[0]).toHaveProperty('id');
      expect(subscriptions[0]).toHaveProperty('user_id');
      expect(subscriptions[0]).toHaveProperty('status');
    });

    it('should approve subscription', async () => {
      const subscriptions = await mockAdapter.getSubscriptions();
      const pending = subscriptions.find(s => s.status === 'pending_review');
      
      if (pending) {
        await mockAdapter.approveSubscription(pending.id, 'TX123');
        const updated = await mockAdapter.getSubscriptions();
        const approved = updated.find(s => s.id === pending.id);
        
        expect(approved?.status).toBe('active');
        expect(approved?.txn_id).toBe('TX123');
        expect(approved?.started_at).toBeTruthy();
        expect(approved?.expires_at).toBeTruthy();
      }
    });

    it('should reject subscription', async () => {
      const subscriptions = await mockAdapter.getSubscriptions();
      const pending = subscriptions.find(s => s.status === 'pending_review');
      
      if (pending) {
        await mockAdapter.rejectSubscription(pending.id);
        const updated = await mockAdapter.getSubscriptions();
        const rejected = updated.find(s => s.id === pending.id);
        
        expect(rejected?.status).toBe('rejected');
      }
    });
  });

  describe('Trips Management', () => {
    it('should list trips', async () => {
      const trips = await mockAdapter.getTrips();
      expect(trips.length).toBeGreaterThan(0);
      expect(trips[0]).toHaveProperty('id');
      expect(trips[0]).toHaveProperty('creator_user_id');
      expect(trips[0]).toHaveProperty('role');
      expect(trips[0]).toHaveProperty('vehicle_type');
    });
  });

  describe('Admin Stats', () => {
    it('should calculate admin stats correctly', async () => {
      const stats = await mockAdapter.getAdminStats();
      
      expect(stats.total_users).toBeGreaterThan(0);
      expect(stats.active_subscribers).toBeGreaterThanOrEqual(0);
      expect(stats.pending_subscriptions).toBeGreaterThanOrEqual(0);
      expect(stats.total_trips).toBeGreaterThan(0);
      expect(stats.drivers_online).toBeGreaterThanOrEqual(0);
      expect(stats.open_passenger_trips).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Simulator Operations', () => {
    it('should find nearby drivers', async () => {
      const drivers = await mockAdapter.simulateSeeNearbyDrivers({
        lat: -1.9441,
        lng: 30.0619,
        vehicle_type: 'moto'
      });
      
      expect(Array.isArray(drivers)).toBe(true);
      expect(drivers.length).toBeLessThanOrEqual(10); // Max results
      
      if (drivers.length > 1) {
        // Check sorting: most recent first (by last_seen)
        const first = new Date(drivers[0]!.last_seen).getTime();
        const second = new Date(drivers[1]!.last_seen).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should find nearby passengers with access', async () => {
      const result = await mockAdapter.simulateSeeNearbyPassengers({
        lat: -1.9441,
        lng: 30.0619,
        vehicle_type: 'moto',
        hasAccess: true
      });
      
      expect(result).not.toBe('NO_ACCESS');
      expect(Array.isArray(result)).toBe(true);
      
      if (Array.isArray(result) && result.length > 1) {
        // Check sorting: most recent first (by created_at)
        const first = new Date(result[0]!.created_at).getTime();
        const second = new Date(result[1]!.created_at).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should block passengers without access', async () => {
      const result = await mockAdapter.simulateSeeNearbyPassengers({
        lat: -1.9441,
        lng: 30.0619,
        vehicle_type: 'moto',
        hasAccess: false
      });
      
      expect(result).toBe('NO_ACCESS');
    });

    it('should schedule passenger trip', async () => {
      const trip = await mockAdapter.simulateScheduleTripPassenger({
        vehicle_type: 'cab',
        lat: -1.9536,
        lng: 30.0606
      });
      
      expect(trip.role).toBe('passenger');
      expect(trip.vehicle_type).toBe('cab');
      expect(trip.lat).toBe(-1.9536);
      expect(trip.lng).toBe(30.0606);
      expect(trip.status).toBe('open');
    });

    it('should schedule driver trip with access', async () => {
      const result = await mockAdapter.simulateScheduleTripDriver({
        vehicle_type: 'moto',
        lat: -1.9441,
        lng: 30.0619,
        hasAccess: true
      });
      
      expect(result).not.toBe('NO_ACCESS');
      if (typeof result === 'object') {
        expect(result.role).toBe('driver');
        expect(result.vehicle_type).toBe('moto');
      }
    });

    it('should block driver trip without access', async () => {
      const result = await mockAdapter.simulateScheduleTripDriver({
        vehicle_type: 'moto',
        lat: -1.9441,
        lng: 30.0619,
        hasAccess: false
      });
      
      expect(result).toBe('NO_ACCESS');
    });
  });

  describe('Profile Lookup', () => {
    it('should find profile by ref code', async () => {
      const profile = await mockAdapter.getProfileByRefCode('123456');
      expect(profile).toBeTruthy();
      expect(profile?.ref_code).toBe('123456');
      expect(profile?.whatsapp_e164).toBeTruthy();
    });

    it('should return null for unknown ref code', async () => {
      const profile = await mockAdapter.getProfileByRefCode('999999');
      expect(profile).toBeNull();
    });
  });

  describe('Data Reset', () => {
    it('should reset mock data to initial state', async () => {
      // Modify some data first
      await mockAdapter.updateSettings({ subscription_price: 9999 });
      
      // Reset
      await mockAdapter.resetMockData();
      
      // Verify back to defaults
      const settings = await mockAdapter.getSettings();
      expect(settings.subscription_price).toBe(5000);
    });
  });
});