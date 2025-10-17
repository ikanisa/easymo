/**
 * ULTRA-MINIMAL WhatsApp Mobility – Real Adapter (Phase 2)
 *
 * This adapter delegates to the AdminAPI helpers which proxy requests
 * through Supabase Edge Functions. The edge layer enforces the admin
 * token and performs privileged Supabase access server-side so that
 * sensitive credentials (service role key) never reach the browser.
 */

import { AdminAPI } from './api';
import type {
  AdminStats,
  DriverPresence,
  Profile,
  Settings,
  Subscription,
  Trip,
  User,
  VehicleType,
} from './types';

function normalizeSettings(config: Settings & { admin_whatsapp_numbers?: string | string[] | null }): Settings {
  let adminWhatsappNumbers: string | undefined;
  if (Array.isArray(config.admin_whatsapp_numbers)) {
    adminWhatsappNumbers = config.admin_whatsapp_numbers.join(',');
  } else if (typeof config.admin_whatsapp_numbers === 'string') {
    adminWhatsappNumbers = config.admin_whatsapp_numbers;
  }

  return {
    subscription_price: config.subscription_price,
    search_radius_km: config.search_radius_km,
    max_results: config.max_results,
    momo_payee_number: config.momo_payee_number,
    support_phone_e164: config.support_phone_e164,
    admin_whatsapp_numbers: adminWhatsappNumbers,
  };
}

export class RealAdapter {
  constructor(private readonly _apiBase: string, private readonly _adminToken: string) {}

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  async getSettings(): Promise<Settings> {
    const config = await AdminAPI.getSettings();
    return normalizeSettings(config);
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const config = await AdminAPI.saveSettings(patch);
    return normalizeSettings(config);
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  async getUsers(): Promise<User[]> {
    return AdminAPI.getUsers();
  }

  async listUsers(): Promise<User[]> {
    return this.getUsers();
  }

  // ---------------------------------------------------------------------------
  // Trips
  // ---------------------------------------------------------------------------
  async getTrips(): Promise<Trip[]> {
    return AdminAPI.listTrips();
  }

  async updateTripStatus(id: number, status: Trip['status']): Promise<void> {
    if (status === 'expired' || status === 'closed') {
      await AdminAPI.closeTrip(id);
      return;
    }
    throw new Error(`updateTripStatus: unsupported status "${status}"`);
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------
  async getSubscriptions(): Promise<Subscription[]> {
    return AdminAPI.listSubs();
  }

  async approveSubscription(id: number, txnId?: string): Promise<void> {
    await AdminAPI.approveSub(id, txnId);
  }

  async rejectSubscription(id: number, reason?: string): Promise<void> {
    await AdminAPI.rejectSub(id, reason);
  }

  // ---------------------------------------------------------------------------
  // Admin Metrics
  // ---------------------------------------------------------------------------
  async getAdminStats(): Promise<AdminStats> {
    return AdminAPI.getStats();
  }

  // ---------------------------------------------------------------------------
  // Simulator Operations
  // ---------------------------------------------------------------------------
  async simulateSeeNearbyDrivers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    radius_km?: number;
    max?: number;
  }): Promise<DriverPresence[]> {
    return AdminAPI.simulatorDrivers(params);
  }

  async simulateSeeNearbyPassengers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    hasAccess?: boolean;
    driver_ref_code?: string;
    radius_km?: number;
    max?: number;
  }): Promise<Trip[] | 'NO_ACCESS'> {
    const response = await AdminAPI.simulatorPassengers({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
      driver_ref_code: params.driver_ref_code,
      force_access: params.hasAccess,
      radius_km: params.radius_km,
      max: params.max,
    });

    if (!response.access) {
      return 'NO_ACCESS';
    }

    return (response.trips ?? []).map((trip) => ({
      ...trip,
      lat: trip.lat ?? params.lat,
      lng: trip.lng ?? params.lng,
    }));
  }

  async simulateScheduleTripPassenger(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    refCode: string;
  }): Promise<Trip> {
    if (!params.refCode) {
      throw new Error('Passenger ref code required in live mode');
    }

    return AdminAPI.simulatorSchedulePassenger({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
      ref_code: params.refCode,
    });
  }

  async simulateScheduleTripDriver(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    hasAccess: boolean;
    refCode: string;
  }): Promise<Trip | 'NO_ACCESS'> {
    if (!params.refCode) {
      throw new Error('Driver ref code required in live mode');
    }

    const result = await AdminAPI.simulatorScheduleDriver({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
      ref_code: params.refCode,
      force_access: params.hasAccess,
    });

    if (!result.access) {
      return 'NO_ACCESS';
    }

    return result.trip;
  }

  async getProfileByRefCode(refCode: string): Promise<Profile | null> {
    return AdminAPI.simulatorProfile(refCode);
  }

  async resetMockData(): Promise<void> {
    throw new Error('resetMockData not available in real adapter');
  }
}
