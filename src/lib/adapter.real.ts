/**
 * ULTRA-MINIMAL WhatsApp Mobility - Real Adapter (Phase-2 Production)
 * Calls Edge Function APIs for production admin operations
 */

import { AdminAPI } from './api';
import type { 
  Profile, 
  DriverPresence, 
  Trip, 
  Subscription, 
  Settings, 
  AdminStats, 
  User,
  VehicleType 
} from './types';

export class RealAdapter {
  constructor(private apiBase: string, private adminToken: string) {}

  // Settings
  async getSettings(): Promise<Settings> {
    const data = await AdminAPI.getSettings();
    return {
      subscription_price: data.subscription_price,
      search_radius_km: data.search_radius_km,
      max_results: data.max_results,
      momo_payee_number: data.momo_payee_number,
      support_phone_e164: data.support_phone_e164,
      admin_whatsapp_numbers: data.admin_whatsapp_numbers,
    };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const data = await AdminAPI.saveSettings(patch);
    return {
      subscription_price: data.subscription_price,
      search_radius_km: data.search_radius_km,
      max_results: data.max_results,
      momo_payee_number: data.momo_payee_number,
      support_phone_e164: data.support_phone_e164,
      admin_whatsapp_numbers: data.admin_whatsapp_numbers,
    };
  }

  // Users (compatibility)
  async listUsers(): Promise<User[]> {
    return AdminAPI.getUsers();
  }

  async getUsers(): Promise<User[]> {
    return this.listUsers();
  }

  // Trips
  async getTrips(): Promise<Trip[]> {
    return AdminAPI.listTrips();
  }

  // Subscriptions  
  async getSubscriptions(): Promise<Subscription[]> {
    return AdminAPI.listSubs();
  }

  async approveSubscription(id: number, txnId?: string): Promise<void> {
    await AdminAPI.approveSub(id, txnId);
  }

  async rejectSubscription(id: number): Promise<void> {
    await AdminAPI.rejectSub(id);
  }

  // Admin Stats
  async getAdminStats(): Promise<AdminStats> {
    return AdminAPI.getStats();
  }

  // Simulator Operations (Phase-2 will use real geospatial queries)
  async simulateSeeNearbyDrivers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
  }): Promise<DriverPresence[]> {
    const drivers = await AdminAPI.simulatorDrivers({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
    });

    return drivers.map((driver) => ({
      user_id: driver.user_id,
      vehicle_type: driver.vehicle_type ?? params.vehicle_type,
      last_seen: driver.last_seen,
      ref_code: driver.ref_code,
      whatsapp_e164: driver.whatsapp_e164,
      lat: driver.lat,
      lng: driver.lng,
    }));
  }

  async simulateSeeNearbyPassengers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    hasAccess?: boolean;
    driver_ref_code?: string;
  }): Promise<Trip[] | 'NO_ACCESS'> {
    const response = await AdminAPI.simulatorPassengers({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
      driver_ref_code: params.driver_ref_code,
      force_access: params.hasAccess,
    });

    if (!response.access) {
      return 'NO_ACCESS';
    }

    return (response.trips ?? []).map((trip) => ({
      id: trip.id,
      creator_user_id: trip.creator_user_id,
      role: trip.role ?? 'passenger',
      vehicle_type: trip.vehicle_type ?? params.vehicle_type,
      created_at: trip.created_at,
      status: trip.status,
      ref_code: trip.ref_code,
      whatsapp_e164: trip.whatsapp_e164,
      lat: trip.lat,
      lng: trip.lng,
    }));
  }

  async simulateScheduleTripPassenger(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    refCode?: string;
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
    refCode?: string;
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

  // Get profiles by ref codes (for simulator lookups)
  async getProfileByRefCode(refCode: string): Promise<Profile | null> {
    return AdminAPI.simulatorProfile(refCode);
  }

  // Dev utility (no-op in real)
  async resetMockData(): Promise<void> {
    throw new Error("resetMockData not available in real adapter");
  }
}
