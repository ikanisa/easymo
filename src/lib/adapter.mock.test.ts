import { describe, it, expect, beforeEach } from 'vitest';
import { mockAdapter } from './adapter.mock';
import type { VehicleType } from './types';

describe('MockAdapter', () => {
  beforeEach(async () => {
    // Reset to clean state before each test
    await mockAdapter.resetMockData();
  });

  describe('Settings', () => {
    it('should get default settings', async () => {
      const settings = await mockAdapter.getSettings();
      expect(settings.subscription_price).toBe(5000);
      expect(settings.max_results).toBe(10);
      expect(settings.search_radius_km).toBe(5.0);
    });

    it('should update settings', async () => {
      await mockAdapter.updateSettings({ subscription_price: 6000 });
      const settings = await mockAdapter.getSettings();
      expect(settings.subscription_price).toBe(6000);
    });
  });

  describe('Subscriptions', () => {
    it('should get subscriptions', async () => {
      const subscriptions = await mockAdapter.getSubscriptions();
      expect(Array.isArray(subscriptions)).toBe(true);
      expect(subscriptions.length).toBeGreaterThan(0);
    });

    it('should approve subscription', async () => {
      const subscriptions = await mockAdapter.getSubscriptions();
      const pendingSub = subscriptions.find(s => s.status === 'pending_review');
      
      if (pendingSub) {
        await mockAdapter.approveSubscription(pendingSub.id, 'TEST123');
        const updated = await mockAdapter.getSubscriptions();
        const approvedSub = updated.find(s => s.id === pendingSub.id);
        expect(approvedSub?.status).toBe('active');
        expect(approvedSub?.txn_id).toBe('TEST123');
      }
    });
  });

  describe('Simulator Operations', () => {
    it('should simulate seeing nearby drivers', async () => {
      const drivers = await mockAdapter.simulateSeeNearbyDrivers({
        lat: -1.9441,
        lng: 30.0619,
        vehicle_type: 'moto' as VehicleType
      });
      
      expect(Array.isArray(drivers)).toBe(true);
      expect(drivers.length).toBeLessThanOrEqual(10); // max_results
      // Should be sorted by last_seen desc (most recent first)
      if (drivers.length > 1) {
        expect(new Date(drivers[0].last_seen).getTime()).toBeGreaterThanOrEqual(
          new Date(drivers[1].last_seen).getTime()
        );
      }
    });

    it('should simulate seeing nearby passengers with access', async () => {
      const trips = await mockAdapter.simulateSeeNearbyPassengers({
        lat: -1.9441,
        lng: 30.0619,
        vehicle_type: 'moto' as VehicleType,
        hasAccess: true
      });
      
      expect(trips).not.toBe('NO_ACCESS');
      if (Array.isArray(trips)) {
        expect(trips.length).toBeLessThanOrEqual(10); // max_results
        // Should be sorted by created_at desc (most recent first)
        if (trips.length > 1) {
          expect(new Date(trips[0].created_at).getTime()).toBeGreaterThanOrEqual(
            new Date(trips[1].created_at).getTime()
          );
        }
      }
    });

    it('should deny passenger list without access', async () => {
      const result = await mockAdapter.simulateSeeNearbyPassengers({
        lat: -1.9441,
        lng: 30.0619,
        vehicle_type: 'moto' as VehicleType,
        hasAccess: false
      });
      
      expect(result).toBe('NO_ACCESS');
    });

    it('should schedule trip as passenger', async () => {
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

    it('should deny driver trip scheduling without access', async () => {
      const result = await mockAdapter.simulateScheduleTripDriver({
        vehicle_type: 'moto',
        lat: -1.9441,
        lng: 30.0619,
        hasAccess: false
      });
      
      expect(result).toBe('NO_ACCESS');
    });
  });

  describe('Admin Stats', () => {
    it('should get admin stats', async () => {
      const stats = await mockAdapter.getAdminStats();
      expect(typeof stats.total_users).toBe('number');
      expect(typeof stats.active_subscribers).toBe('number');
      expect(typeof stats.pending_subscriptions).toBe('number');
      expect(typeof stats.total_trips).toBe('number');
      expect(typeof stats.drivers_online).toBe('number');
      expect(typeof stats.open_passenger_trips).toBe('number');
    });
  });
});