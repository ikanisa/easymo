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
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase PostGIS");
  }

  async simulateSeeNearbyPassengers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    hasAccess: boolean;
  }): Promise<Trip[] | 'NO_ACCESS'> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase PostGIS");
  }

  async simulateScheduleTripPassenger(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
  }): Promise<Trip> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  async simulateScheduleTripDriver(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    hasAccess: boolean;
  }): Promise<Trip | 'NO_ACCESS'> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  // Get profiles by ref codes (for simulator lookups)
  async getProfileByRefCode(refCode: string): Promise<Profile | null> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  // Dev utility (no-op in real)
  async resetMockData(): Promise<void> {
    throw new Error("resetMockData not available in real adapter");
  }
}