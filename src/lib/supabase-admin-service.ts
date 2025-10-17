import type { SupabaseClient } from '@supabase/supabase-js';
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

const DEFAULT_RADIUS_KM = Number(import.meta.env.SIMULATOR_DEFAULT_RADIUS_KM ?? 5);
const DEFAULT_MAX_RESULTS = Number(import.meta.env.SIMULATOR_MAX_RESULTS ?? 10);

let cachedClient: SupabaseClient | null = null;

function resolveClient(client?: SupabaseClient): SupabaseClient {
  if (client) {
    return client;
  }
  if (!cachedClient) {
    cachedClient = getSupabaseServiceClient();
  }
  return cachedClient;
}

type SettingsRow = {
  subscription_price: number;
  search_radius_km: number;
  max_results: number;
  momo_payee_number: string;
  support_phone_e164: string;
  admin_whatsapp_numbers: string[] | string | null;
};

type SubscriptionRow = {
  id: number;
  user_id: string;
  status: string;
  amount: number;
  txn_id: string | null;
  proof_url: string | null;
  created_at: string;
  started_at: string | null;
  expires_at: string | null;
  profiles?: { ref_code: string; whatsapp_e164: string } | null;
};

type TripRow = {
  id: number;
  creator_user_id: string;
  role: 'driver' | 'passenger';
  vehicle_type: VehicleType;
  status: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  profiles?: { ref_code: string; whatsapp_e164: string } | null;
  ref_code?: string | null;
  whatsapp_e164?: string | null;
};

type ProfileRow = {
  user_id: string;
  whatsapp_e164: string;
  ref_code: string;
  credits_balance: number;
  created_at: string;
  locale?: string | null;
  subscriptions?: Array<{
    id: number;
    status: string;
    expires_at: string | null;
  }> | null;
};

type NearbyDriverRow = {
  user_id: string;
  vehicle_type: VehicleType;
  last_seen: string;
  lat: number | null;
  lng: number | null;
  ref_code: string | null;
  whatsapp_e164: string | null;
};

type NearbyPassengerResponse = {
  access: boolean;
  reason?: string;
  credits_left?: number | null;
  used_credit?: boolean;
  trips?: TripRow[] | null;
};

function toSettings(row: SettingsRow): Settings {
  return {
    subscription_price: row.subscription_price,
    search_radius_km: row.search_radius_km,
    max_results: row.max_results,
    momo_payee_number: row.momo_payee_number,
    support_phone_e164: row.support_phone_e164,
    admin_whatsapp_numbers: Array.isArray(row.admin_whatsapp_numbers)
      ? row.admin_whatsapp_numbers.join(',')
      : row.admin_whatsapp_numbers ?? undefined,
  };
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status as Subscription['status'],
    amount: row.amount,
    txn_id: row.txn_id,
    proof_url: row.proof_url,
    created_at: row.created_at,
    started_at: row.started_at,
    expires_at: row.expires_at,
    user_ref_code: row.profiles?.ref_code,
  };
}

function toTrip(row: TripRow): Trip {
  const normalizedStatus: Trip['status'] = (() => {
    const raw = (row.status ?? 'active').toLowerCase();
    if (raw === 'active' || raw === 'open' || raw === 'pending') {
      return 'open';
    }
    if (raw === 'closed' || raw === 'expired' || raw === 'complete') {
      return 'expired';
    }
    return 'open';
  })();

  return {
    id: row.id,
    creator_user_id: row.creator_user_id,
    role: row.role,
    vehicle_type: row.vehicle_type,
    status: normalizedStatus,
    created_at: row.created_at,
    ref_code: row.ref_code ?? row.profiles?.ref_code ?? undefined,
    whatsapp_e164: row.whatsapp_e164 ?? row.profiles?.whatsapp_e164 ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
  };
}

function toProfile(row: ProfileRow): Profile {
  return {
    user_id: row.user_id,
    whatsapp_e164: row.whatsapp_e164,
    ref_code: row.ref_code,
    credits_balance: row.credits_balance,
    created_at: row.created_at,
  };
}

function toUser(row: ProfileRow): User {
  const subs = row.subscriptions ?? [];
  const active = subs.find((sub) => {
    if (sub.status !== 'active') return false;
    if (!sub.expires_at) return true;
    return new Date(sub.expires_at).getTime() > Date.now();
  });

  const subscriptionStatus: User['subscription_status'] = subs.length === 0
    ? 'none'
    : active
    ? 'active'
    : 'expired';

  return {
    user_id: row.user_id,
    whatsapp_e164: row.whatsapp_e164,
    ref_code: row.ref_code,
    credits_balance: row.credits_balance,
    created_at: row.created_at,
    subscription_status,
    id: row.user_id,
    whatsapp_number: row.whatsapp_e164,
    name: null,
  };
}

function assertSuccess<T>(
  result: { data: T | null; error: any },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message ?? result.error}`);
  }
  if (!result.data) {
    throw new Error(`${context}: empty result`);
  }
  return result.data;
}

export async function fetchSettings(
  client?: SupabaseClient,
): Promise<Settings> {
  const supabase = resolveClient(client);
  const result = await supabase.from('settings')
    .select('subscription_price,search_radius_km,max_results,momo_payee_number,support_phone_e164,admin_whatsapp_numbers')
    .single();
  return toSettings(assertSuccess(result, 'settings.fetch'));
}

export async function updateSettings(
  patch: Partial<Settings>,
  client?: SupabaseClient,
): Promise<Settings> {
  const supabase = resolveClient(client);
  const updatePayload: Partial<SettingsRow> & { updated_at?: string } = {
    ...patch,
    admin_whatsapp_numbers: patch.admin_whatsapp_numbers
      ? patch.admin_whatsapp_numbers.split(',').map((v) => v.trim()).filter(Boolean)
      : undefined,
    momo_payee_number: patch.momo_payee_number,
    support_phone_e164: patch.support_phone_e164,
  };

  const result = await supabase.from('settings')
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('subscription_price,search_radius_km,max_results,momo_payee_number,support_phone_e164,admin_whatsapp_numbers')
    .single();
  return toSettings(assertSuccess(result, 'settings.update'));
}

export async function listUsers(
  client?: SupabaseClient,
): Promise<User[]> {
  const supabase = resolveClient(client);
  const result = await supabase.from('profiles')
    .select('user_id,whatsapp_e164,ref_code,credits_balance,created_at,subscriptions(id,status,expires_at)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (result.error) {
    throw new Error(`profiles.list: ${result.error.message ?? result.error}`);
  }
  const rows = (result.data ?? []) as ProfileRow[];
  return rows.map(toUser);
}

export async function listTrips(
  client?: SupabaseClient,
): Promise<Trip[]> {
  const supabase = resolveClient(client);
  const result = await supabase.from('trips')
    .select('id,creator_user_id,role,vehicle_type,status,created_at,lat,lng,profiles(ref_code,whatsapp_e164)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (result.error) {
    throw new Error(`trips.list: ${result.error.message ?? result.error}`);
  }
  const rows = (result.data ?? []) as TripRow[];
  return rows.map(toTrip);
}

export async function closeTrip(
  id: number,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = resolveClient(client);
  const result = await supabase.from('trips')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .not('status', 'eq', 'closed')
    .select('id')
    .maybeSingle();
  if (result.error) {
    throw new Error(`trips.close: ${result.error.message ?? result.error}`);
  }
}

export async function listSubscriptions(
  client?: SupabaseClient,
): Promise<Subscription[]> {
  const supabase = resolveClient(client);
  const result = await supabase.from('subscriptions')
    .select('id,user_id,status,amount,txn_id,proof_url,created_at,started_at,expires_at,profiles(ref_code,whatsapp_e164)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (result.error) {
    throw new Error(`subscriptions.list: ${result.error.message ?? result.error}`);
  }
  const rows = (result.data ?? []) as SubscriptionRow[];
  return rows.map(toSubscription);
}

export async function approveSubscription(
  id: number,
  txnId?: string,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = resolveClient(client);
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const result = await supabase.from('subscriptions')
    .update({
      status: 'active',
      txn_id: txnId ?? null,
      started_at: now.toISOString(),
      expires_at: expires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .in('status', ['pending_review', 'pending', 'review'])
    .select('id')
    .maybeSingle();
  if (result.error) {
    throw new Error(`subscriptions.approve: ${result.error.message ?? result.error}`);
  }
}

export async function rejectSubscription(
  id: number,
  reason?: string,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = resolveClient(client);
  const result = await supabase.from('subscriptions')
    .update({
      status: 'rejected',
      rejection_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['pending_review', 'pending', 'review'])
    .select('id')
    .maybeSingle();
  if (result.error) {
    throw new Error(`subscriptions.reject: ${result.error.message ?? result.error}`);
  }
}

export async function fetchAdminStats(
  client?: SupabaseClient,
): Promise<AdminStats> {
  const supabase = resolveClient(client);
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const [drivers, trips, subs] = await Promise.all([
    supabase.from('driver_presence')
      .select('user_id', { count: 'exact', head: true })
      .gt('last_seen', tenMinutesAgo),
    supabase.from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('expires_at', nowIso),
  ]);

  const firstError = drivers.error ?? trips.error ?? subs.error;
  if (firstError) {
    throw new Error(`admin.stats: ${firstError.message ?? firstError}`);
  }

  return {
    drivers_online: drivers.count ?? 0,
    open_trips: trips.count ?? 0,
    active_subscriptions: subs.count ?? 0,
  };
}

export async function findProfileByRefCode(
  refCode: string,
  client?: SupabaseClient,
): Promise<Profile | null> {
  const supabase = resolveClient(client);
  const result = await supabase.from('profiles')
    .select('user_id,whatsapp_e164,ref_code,credits_balance,created_at')
    .eq('ref_code', refCode)
    .maybeSingle();
  if (result.error) {
    throw new Error(`profiles.by_ref: ${result.error.message ?? result.error}`);
  }
  return result.data ? toProfile(result.data as ProfileRow) : null;
}

async function hasActiveSubscription(
  userId: string,
  client: SupabaseClient,
): Promise<boolean> {
  const result = await client.from('subscriptions')
    .select('id,expires_at,status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1);
  if (result.error) {
    throw new Error(`subscriptions.check_active: ${result.error.message ?? result.error}`);
  }
  const [row] = (result.data ?? []) as Array<{ expires_at: string | null }>;
  if (!row) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function simulateSeeNearbyDrivers(
  params: { lat: number; lng: number; vehicle_type: VehicleType; radius_km?: number; max?: number },
  client?: SupabaseClient,
): Promise<DriverPresence[]> {
  const supabase = resolveClient(client);
  const radius = params.radius_km ?? DEFAULT_RADIUS_KM;
  const maxResults = params.max ?? DEFAULT_MAX_RESULTS;

  const result = await supabase.rpc('simulator_find_nearby_drivers', {
    lat: params.lat,
    lng: params.lng,
    radius_km: radius,
    max_results: maxResults,
    vehicle_type: params.vehicle_type,
  });
  if (result.error) {
    throw new Error(`simulator.drivers: ${result.error.message ?? result.error}`);
  }
  const rows = (result.data ?? []) as NearbyDriverRow[];
  return rows.slice(0, maxResults).map((row) => ({
    user_id: row.user_id,
    vehicle_type: row.vehicle_type,
    last_seen: row.last_seen,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    ref_code: row.ref_code ?? undefined,
    whatsapp_e164: row.whatsapp_e164 ?? undefined,
  }));
}

export async function simulateSeeNearbyPassengers(
  params: {
    lat: number;
    lng: number;
    vehicle_type: VehicleType;
    driver_ref_code?: string;
    force_access?: boolean;
    radius_km?: number;
    max?: number;
  },
  client?: SupabaseClient,
): Promise<{ access: boolean; trips?: Trip[]; reason?: string; credits_left?: number | null; used_credit?: boolean }> {
  const supabase = resolveClient(client);
  const radius = params.radius_km ?? DEFAULT_RADIUS_KM;
  const maxResults = params.max ?? DEFAULT_MAX_RESULTS;

  if (!params.force_access && params.driver_ref_code) {
    const driver = await findProfileByRefCode(params.driver_ref_code, supabase);
    if (!driver) {
      return { access: false, reason: 'driver_not_found' };
    }
    const hasAccess = await hasActiveSubscription(driver.user_id, supabase);
    if (!hasAccess) {
      return { access: false, reason: 'no_subscription' };
    }
  }

  const result = await supabase.rpc('simulator_find_nearby_passenger_trips', {
    lat: params.lat,
    lng: params.lng,
    radius_km: radius,
    max_results: maxResults,
    vehicle_type: params.vehicle_type,
  });

  if (result.error) {
    throw new Error(`simulator.passengers: ${result.error.message ?? result.error}`);
  }

  const payload = (result.data ?? { trips: [] }) as NearbyPassengerResponse;
  if (payload.access === false) {
    return { access: false, reason: payload.reason ?? 'no_access', credits_left: payload.credits_left ?? undefined };
  }

  const trips = (payload.trips ?? []) as TripRow[];
  return {
    access: true,
    trips: trips.map(toTrip),
    credits_left: payload.credits_left ?? undefined,
    used_credit: payload.used_credit ?? undefined,
  };
}

export async function simulateScheduleTripPassenger(
  params: { vehicle_type: VehicleType; lat: number; lng: number; ref_code: string },
  client?: SupabaseClient,
): Promise<Trip> {
  const supabase = resolveClient(client);
  const profile = await findProfileByRefCode(params.ref_code, supabase);
  if (!profile) {
    throw new Error('passenger_not_found');
  }

  const insert = await supabase.from('trips')
    .insert({
      creator_user_id: profile.user_id,
      role: 'passenger',
      vehicle_type: params.vehicle_type,
      status: 'active',
      lat: params.lat,
      lng: params.lng,
    })
    .select('id,creator_user_id,role,vehicle_type,status,created_at,lat,lng,profiles(ref_code,whatsapp_e164)')
    .single();

  return toTrip(assertSuccess(insert, 'simulator.schedule_passenger'));
}

export async function simulateScheduleTripDriver(
  params: {
    vehicle_type: VehicleType;
    lat: number;
    lng: number;
    ref_code: string;
    force_access?: boolean;
  },
  client?: SupabaseClient,
): Promise<{ access: true; trip: Trip; credits_left?: number | null; used_credit?: boolean } | { access: false; reason?: string; credits_left?: number | null; used_credit?: boolean }> {
  const supabase = resolveClient(client);
  const profile = await findProfileByRefCode(params.ref_code, supabase);
  if (!profile) {
    return { access: false, reason: 'driver_not_found' };
  }

  if (!params.force_access) {
    const hasAccess = await hasActiveSubscription(profile.user_id, supabase);
    if (!hasAccess) {
      return { access: false, reason: 'no_subscription' };
    }
  }

  const insert = await supabase.from('trips')
    .insert({
      creator_user_id: profile.user_id,
      role: 'driver',
      vehicle_type: params.vehicle_type,
      status: 'active',
      lat: params.lat,
      lng: params.lng,
    })
    .select('id,creator_user_id,role,vehicle_type,status,created_at,lat,lng,profiles(ref_code,whatsapp_e164)')
    .single();

  const trip = toTrip(assertSuccess(insert, 'simulator.schedule_driver'));

  return { access: true, trip, credits_left: null };
}

export async function getProfileByRefCode(
  refCode: string,
  client?: SupabaseClient,
): Promise<Profile | null> {
  const supabase = resolveClient(client);
  return findProfileByRefCode(refCode, supabase);
}
