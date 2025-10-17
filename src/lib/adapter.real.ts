import type { SupabaseClient } from '@supabase/supabase-js';
import {
  approveSubscription,
  fetchAdminStats,
  fetchSettings,
  getProfileByRefCode,
  listSubscriptions,
  listTrips,
  listUsers,
  rejectSubscription,
  simulateScheduleTripDriver,
  simulateScheduleTripPassenger,
  simulateSeeNearbyDrivers,
  simulateSeeNearbyPassengers,
  updateSettings,
} from './supabase-admin-service';
import { getSupabaseServiceClient } from './supabase-client';
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

export class RealAdapter {
  constructor(private readonly supabase: SupabaseClient = getSupabaseServiceClient()) {}

  async getSettings(): Promise<Settings> {
    return fetchSettings(this.supabase);
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return updateSettings(patch, this.supabase);
  }

  async listUsers(): Promise<User[]> {
    return listUsers(this.supabase);
  }

  async getUsers(): Promise<User[]> {
    return this.listUsers();
  }

  async getTrips(): Promise<Trip[]> {
    return listTrips(this.supabase);
  }

  async getSubscriptions(): Promise<Subscription[]> {
    return listSubscriptions(this.supabase);
  }

  async approveSubscription(id: number, txnId?: string): Promise<void> {
    await approveSubscription(id, txnId, this.supabase);
  }

  async rejectSubscription(id: number, reason?: string): Promise<void> {
    await rejectSubscription(id, reason, this.supabase);
  }

  async getAdminStats(): Promise<AdminStats> {
    return fetchAdminStats(this.supabase);
  }

  async simulateSeeNearbyDrivers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    radius_km?: number;
    max?: number;
  }): Promise<DriverPresence[]> {
    return simulateSeeNearbyDrivers(params, this.supabase);
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
    const response = await simulateSeeNearbyPassengers({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
      force_access: params.hasAccess,
      driver_ref_code: params.driver_ref_code,
      radius_km: params.radius_km,
      max: params.max,
    }, this.supabase);

    if (!response.access) {
      return 'NO_ACCESS';
    }

    return response.trips ?? [];
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

    return simulateScheduleTripPassenger({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
      ref_code: params.refCode,
    }, this.supabase);
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

    const result = await simulateScheduleTripDriver({
      lat: params.lat,
      lng: params.lng,
      vehicle_type: params.vehicle_type,
      ref_code: params.refCode,
      force_access: params.hasAccess,
    }, this.supabase);

    if (!result.access) {
      return 'NO_ACCESS';
    }

    return result.trip;
  }

  async getProfileByRefCode(refCode: string): Promise<Profile | null> {
    return getProfileByRefCode(refCode, this.supabase);
  }

  async resetMockData(): Promise<void> {
    throw new Error('resetMockData not available in real adapter');
  }
}
