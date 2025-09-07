/**
 * ULTRA-MINIMAL WhatsApp Mobility - Real Adapter (Phase-2 Placeholder)
 * All methods throw - to be implemented in Phase-2 with Supabase
 */

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
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  // Users (compatibility)
  async listUsers(): Promise<User[]> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  async getUsers(): Promise<User[]> {
    return this.listUsers();
  }

  // Trips
  async getTrips(): Promise<Trip[]> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  // Subscriptions  
  async getSubscriptions(): Promise<Subscription[]> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  async approveSubscription(id: number, txnId?: string): Promise<void> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  async rejectSubscription(id: number): Promise<void> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
  }

  // Admin Stats
  async getAdminStats(): Promise<AdminStats> {
    throw new Error("Phase 2 not implemented - Real adapter requires Supabase");
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