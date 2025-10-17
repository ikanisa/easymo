import type { AdminStats, DriverPresence, Profile, Settings, Subscription, Trip, User, VehicleType } from './types';
import {
  approveSubscription as supabaseApproveSubscription,
  fetchAdminStats as supabaseFetchAdminStats,
  fetchSettings as supabaseFetchSettings,
  closeTrip as supabaseCloseTrip,
  getProfileByRefCode as supabaseGetProfile,
  listSubscriptions as supabaseListSubscriptions,
  listTrips as supabaseListTrips,
  listUsers as supabaseListUsers,
  rejectSubscription as supabaseRejectSubscription,
  simulateScheduleTripDriver as supabaseScheduleTripDriver,
  simulateScheduleTripPassenger as supabaseScheduleTripPassenger,
  simulateSeeNearbyDrivers as supabaseNearbyDrivers,
  simulateSeeNearbyPassengers as supabaseNearbyPassengers,
  updateSettings as supabaseUpdateSettings,
} from './supabase-admin-service';

type HealthStatus = 'ok' | 'error';

export type HealthCheckResult = {
  status: HealthStatus;
  timestamp: string;
  round_trip_ms: number;
  message?: string;
};

export function isUnauthorized(error: unknown): boolean {
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    return normalized.includes('unauthorized') || normalized.includes('invalid token');
  }
  return false;
}

async function healthCheck(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  const start = performance.now();

  try {
    await supabaseFetchAdminStats();
    return {
      status: 'ok',
      timestamp,
      round_trip_ms: Math.round(performance.now() - start),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return {
      status: 'error',
      timestamp,
      round_trip_ms: Math.round(performance.now() - start),
      message,
    };
  }
}

export const AdminAPI = {
  getSettings: (): Promise<Settings> => supabaseFetchSettings(),
  saveSettings: (patch: Partial<Settings>): Promise<Settings> => supabaseUpdateSettings(patch),
  getStats: (): Promise<AdminStats> => supabaseFetchAdminStats(),
  getUsers: (): Promise<User[]> => supabaseListUsers(),
  listTrips: (): Promise<Trip[]> => supabaseListTrips(),
  closeTrip: (id: number): Promise<void> => supabaseCloseTrip(id),
  listSubs: (): Promise<Subscription[]> => supabaseListSubscriptions(),
  approveSub: (id: number, txnId?: string): Promise<void> => supabaseApproveSubscription(id, txnId),
  rejectSub: (id: number, reason?: string): Promise<void> => supabaseRejectSubscription(id, reason),
  simulatorDrivers: (params: { lat: number; lng: number; vehicle_type: VehicleType; radius_km?: number; max?: number }): Promise<DriverPresence[]> =>
    supabaseNearbyDrivers(params),
  simulatorPassengers: (params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    driver_ref_code?: string;
    force_access?: boolean;
    radius_km?: number;
    max?: number;
  }): Promise<{ access: boolean; trips?: Trip[]; reason?: string; credits_left?: number | null; used_credit?: boolean }>
    => supabaseNearbyPassengers(params),
  simulatorSchedulePassenger: (params: { lat: number; lng: number; vehicle_type: VehicleType; ref_code: string }): Promise<Trip>
    => supabaseScheduleTripPassenger(params),
  simulatorScheduleDriver: (params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    ref_code: string;
    force_access?: boolean;
  }): Promise<{ access: false; reason?: string; credits_left?: number | null; used_credit?: boolean } | { access: true; trip: Trip; credits_left?: number | null; used_credit?: boolean }>
    => supabaseScheduleTripDriver(params),
  simulatorProfile: (refCode: string): Promise<Profile | null> => supabaseGetProfile(refCode),
  healthCheck,
};
