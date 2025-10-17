/**
 * ULTRA-MINIMAL WhatsApp Mobility – Real Adapter (Phase‑2 Production)
 *
 * This adapter connects the admin panel directly to the Supabase database
 * using the service role key.  It replaces the previous implementation
 * which routed requests through the REST edge functions.  By querying
 * tables directly we remove an additional network hop and have full
 * type‑safe access to data.  You must supply a Supabase service role
 * key via environment variable in order for these calls to succeed.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

/**
 * Read Supabase configuration from environment variables.  These values
 * should be provided at build time (e.g. VITE_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY).  If they are missing the adapter will
 * throw at runtime.  See `.env.example` for required keys.
 */
function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase URL or service role key is not configured');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export class RealAdapter {
  private supabase: SupabaseClient;

  /**
   * Construct a new RealAdapter.  apiBase and adminToken are unused in the
   * direct Supabase implementation but kept for backwards compatibility.
   */
  constructor(private apiBase: string = '', private adminToken: string = '') {
    this.supabase = createSupabaseClient();
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  /**
   * Retrieve the application settings.  The settings table should contain a
   * single row with application configuration values.  If no row is found
   * an error is thrown.
   */
  async getSettings(): Promise<Settings> {
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Settings not configured');
    return {
      subscription_price: data.subscription_price,
      search_radius_km: data.search_radius_km,
      max_results: data.max_results,
      momo_payee_number: data.momo_payee_number,
      support_phone_e164: data.support_phone_e164,
      admin_whatsapp_numbers: data.admin_whatsapp_numbers ?? undefined,
    };
  }

  /**
   * Patch the settings table with partial updates.  Only fields present in the
   * patch will be updated.  The function returns the updated settings row.
   */
  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    // Fetch existing row id so we know which row to update
    const { data: existing, error: fetchErr } = await this.supabase
      .from('settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) throw new Error('Settings row does not exist');
    const { data, error } = await this.supabase
      .from('settings')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Unable to update settings');
    return {
      subscription_price: data.subscription_price,
      search_radius_km: data.search_radius_km,
      max_results: data.max_results,
      momo_payee_number: data.momo_payee_number,
      support_phone_e164: data.support_phone_e164,
      admin_whatsapp_numbers: data.admin_whatsapp_numbers ?? undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  /**
   * Fetch all users including their profile metadata.  This method joins the
   * `auth.users` built‑in table with our custom `profiles` table.  Use of
   * `.select()` with foreign table references requires the `select` option
   * (set returnType) from supabase-js v2.
   */
  async getUsers(): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(
        `user_id, whatsapp_e164:whatsapp_e164, ref_code, credits_balance, created_at,
        auth_users!inner(id)`
      );
    if (error) throw error;
    if (!data) return [];
    return data.map((row: any) => ({
      user_id: row.user_id,
      whatsapp_e164: row.whatsapp_e164,
      ref_code: row.ref_code,
      credits_balance: row.credits_balance ?? 0,
      subscription_status: 'none', // This field will be populated later via subscriptions
      created_at: row.created_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // Trips
  // ---------------------------------------------------------------------------
  /**
   * Retrieve all open trips along with passenger/driver metadata.  Joins
   * the trips table with driver_presence and profiles to enrich the results.
   */
  async getTrips(): Promise<Trip[]> {
    const { data, error } = await this.supabase
      .from('trips')
      .select(
        `id, creator_user_id, role, vehicle_type, created_at, status,
         ref_code,
         whatsapp_e164,
         lat,
         lng`
      );
    if (error) throw error;
    if (!data) return [];
    return data.map((row: any) => ({
      id: row.id,
      creator_user_id: row.creator_user_id,
      role: row.role,
      vehicle_type: row.vehicle_type,
      created_at: row.created_at,
      status: row.status ?? undefined,
      ref_code: row.ref_code ?? undefined,
      whatsapp_e164: row.whatsapp_e164 ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
    }));
  }

  /**
   * Update the status of a trip.  Accepts a numeric id and new status.
   */
  async updateTripStatus(id: number, status: Trip['status']): Promise<void> {
    const { error } = await this.supabase
      .from('trips')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------
  /**
   * Retrieve all subscriptions with their associated user information.  Joins
   * the subscriptions and profiles tables.
   */
  async getSubscriptions(): Promise<Subscription[]> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select(
        `id, user_id, status, started_at, expires_at, amount, proof_url, created_at,
         profiles:profiles(user_id, ref_code)`
      );
    if (error) throw error;
    if (!data) return [];
    return data.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      started_at: row.started_at,
      expires_at: row.expires_at,
      amount: row.amount,
      proof_url: row.proof_url,
      created_at: row.created_at,
      user_ref_code: row.profiles?.ref_code ?? undefined,
    }));
  }

  /**
   * Approve a pending subscription.  Updates the status and optionally
   * records a momo transaction id in a future audits table.  If no row is
   * updated the call will succeed silently.  Admins must have service role.
   */
  async approveSubscription(id: number, txnId?: string): Promise<void> {
    const updates: Partial<Subscription> & { status: Subscription['status'] } = {
      status: 'active',
    };
    if (txnId) {
      (updates as any).txn_id = txnId;
    }
    const { error } = await this.supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  /**
   * Reject a subscription.  Marks the status as rejected.  Optionally
   * records a reason for future audit.
   */
  async rejectSubscription(id: number, reason?: string): Promise<void> {
    const updates: any = { status: 'rejected' };
    if (reason) {
      updates.rejection_reason = reason;
    }
    const { error } = await this.supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  // ---------------------------------------------------------------------------
  // Admin Metrics
  // ---------------------------------------------------------------------------
  /**
   * Compute simple admin statistics.  This implementation uses aggregate
   * queries directly on the relevant tables.  For more complex metrics you
   * could create a Postgres view or a stored procedure.
   */
  async getAdminStats(): Promise<AdminStats> {
    // Count drivers online (driver_presence rows where last_seen within 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: driversOnline, error: dpErr } = await this.supabase
      .from('driver_presence')
      .select('user_id', { count: 'exact' })
      .gte('last_seen', fifteenMinutesAgo);
    if (dpErr) throw dpErr;
    // Count open trips
    const { count: openTrips, error: tripErr } = await this.supabase
      .from('trips')
      .select('id', { count: 'exact' })
      .is('status', null);
    if (tripErr) throw tripErr;
    // Count active subscriptions
    const now = new Date().toISOString();
    const { count: activeSubs, error: subErr } = await this.supabase
      .from('subscriptions')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
      .gte('expires_at', now);
    if (subErr) throw subErr;
    return {
      drivers_online: driversOnline ?? 0,
      open_trips: openTrips ?? 0,
      active_subscriptions: activeSubs ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Simulator Operations
  // ---------------------------------------------------------------------------
  /**
   * Find nearby drivers for the simulator.  Uses a simple bounding box
   * approximation rather than full PostGIS geospatial functions.  For
   * production use you should replace this with a PostGIS `ST_DWithin`
   * query.  The radius (in kilometres) and maximum results are derived
   * from the settings table.
   */
  async simulateSeeNearbyDrivers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
  }): Promise<DriverPresence[]> {
    // Load radius and max from settings
    const settings = await this.getSettings();
    const radiusKm = settings.search_radius_km;
    const max = settings.max_results;
    // Compute bounding box (very rough) – 1 deg latitude ≈ 111 km
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((params.lat * Math.PI) / 180));
    const { data, error } = await this.supabase
      .from('driver_presence')
      .select('*')
      .eq('vehicle_type', params.vehicle_type)
      .gte('lat', params.lat - latDelta)
      .lte('lat', params.lat + latDelta)
      .gte('lng', params.lng - lngDelta)
      .lte('lng', params.lng + lngDelta)
      .order('last_seen', { ascending: false })
      .limit(max);
    if (error) throw error;
    return (
      data?.map((row: any) => ({
        user_id: row.user_id,
        vehicle_type: row.vehicle_type,
        last_seen: row.last_seen,
        ref_code: row.ref_code ?? undefined,
        whatsapp_e164: row.whatsapp_e164 ?? undefined,
        lat: row.lat ?? undefined,
        lng: row.lng ?? undefined,
      })) ?? []
    );
  }

  /**
   * Find nearby passenger trips for the simulator.  If the driver does not
   * have access (no subscription or credit) the method returns 'NO_ACCESS'.
   * Otherwise it returns a list of trips ordered by most recent.
   */
  async simulateSeeNearbyPassengers(params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    hasAccess?: boolean;
    driver_ref_code?: string;
  }): Promise<Trip[] | 'NO_ACCESS'> {
    // Check access: in phase‑2 you would verify the driver subscription
    if (!params.hasAccess) {
      // Without forced access this returns no access.  Extend this logic by
      // querying subscriptions for the driver when implementing credits.
      return 'NO_ACCESS';
    }
    const settings = await this.getSettings();
    const radiusKm = settings.search_radius_km;
    const max = settings.max_results;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((params.lat * Math.PI) / 180));
    const { data, error } = await this.supabase
      .from('trips')
      .select('*')
      .eq('role', 'passenger')
      .eq('vehicle_type', params.vehicle_type)
      .gte('lat', params.lat - latDelta)
      .lte('lat', params.lat + latDelta)
      .gte('lng', params.lng - lngDelta)
      .lte('lng', params.lng + lngDelta)
      .order('created_at', { ascending: false })
      .limit(max);
    if (error) throw error;
    return (
      data?.map((row: any) => ({
        id: row.id,
        creator_user_id: row.creator_user_id,
        role: row.role,
        vehicle_type: row.vehicle_type,
        created_at: row.created_at,
        status: row.status ?? undefined,
        ref_code: row.ref_code ?? undefined,
        whatsapp_e164: row.whatsapp_e164 ?? undefined,
        lat: row.lat ?? undefined,
        lng: row.lng ?? undefined,
      })) ?? []
    );
  }

  /**
   * Schedule a passenger trip in the simulator.  In live mode the caller
   * must supply a referral code; this method inserts a new row into the
   * trips table and returns the created trip.  Coordinates are stored in
   * decimal degrees.
   */
  async simulateScheduleTripPassenger(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    refCode: string;
  }): Promise<Trip> {
    // Insert a new trip with role=passenger
    const { data, error } = await this.supabase
      .from('trips')
      .insert({
        creator_user_id: params.refCode, // In phase‑2 map refCode -> user_id via profiles
        role: 'passenger',
        vehicle_type: params.vehicle_type,
        lat: params.lat,
        lng: params.lng,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Failed to schedule passenger trip');
    return {
      id: data.id,
      creator_user_id: data.creator_user_id,
      role: data.role,
      vehicle_type: data.vehicle_type,
      created_at: data.created_at,
      status: data.status ?? undefined,
      ref_code: data.ref_code ?? undefined,
      whatsapp_e164: data.whatsapp_e164 ?? undefined,
      lat: data.lat ?? undefined,
      lng: data.lng ?? undefined,
    };
  }

  /**
   * Schedule a driver for the simulator.  If `hasAccess` is false the
   * function returns 'NO_ACCESS'.  Otherwise it creates a new driver trip.
   */
  async simulateScheduleTripDriver(params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    hasAccess: boolean;
    refCode: string;
  }): Promise<Trip | 'NO_ACCESS'> {
    if (!params.hasAccess) {
      return 'NO_ACCESS';
    }
    const { data, error } = await this.supabase
      .from('trips')
      .insert({
        creator_user_id: params.refCode, // Map ref code to user id via profiles
        role: 'driver',
        vehicle_type: params.vehicle_type,
        lat: params.lat,
        lng: params.lng,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Failed to schedule driver trip');
    return {
      id: data.id,
      creator_user_id: data.creator_user_id,
      role: data.role,
      vehicle_type: data.vehicle_type,
      created_at: data.created_at,
      status: data.status ?? undefined,
      ref_code: data.ref_code ?? undefined,
      whatsapp_e164: data.whatsapp_e164 ?? undefined,
      lat: data.lat ?? undefined,
      lng: data.lng ?? undefined,
    };
  }

  /**
   * Look up a profile by referral code for simulator convenience.  Returns
   * null if no profile is found.
   */
  async getProfileByRefCode(refCode: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('ref_code', refCode)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  /**
   * resetMockData is not supported on the real adapter.  The method exists
   * for API compatibility with the mock adapter used in development.
   */
  async resetMockData(): Promise<void> {
    throw new Error('resetMockData not available in real adapter');
  }
}