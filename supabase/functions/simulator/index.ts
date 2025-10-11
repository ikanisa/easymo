import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
  parseNumber,
} from "../_shared/admin.ts";

const supabase = createServiceRoleClient();

type VehicleType = 'moto' | 'cab' | 'lifan' | 'truck' | 'others';

const driverQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  vehicle_type: z.enum(['moto', 'cab', 'lifan', 'truck', 'others']),
  radius_km: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
});

const passengerQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  vehicle_type: z.enum(['moto', 'cab', 'lifan', 'truck', 'others']),
  driver_ref_code: z.string().min(1).optional(),
  force_access: z.coerce.boolean().optional(),
  radius_km: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
});

const profileQuerySchema = z.object({
  ref: z.string().min(1),
});

const schedulePassengerSchema = z.object({
  ref_code: z.string().min(1),
  vehicle_type: z.enum(['moto', 'cab', 'lifan', 'truck', 'others']),
  lat: z.number(),
  lng: z.number(),
});

const scheduleDriverSchema = z.object({
  ref_code: z.string().min(1),
  vehicle_type: z.enum(['moto', 'cab', 'lifan', 'truck', 'others']),
  lat: z.number(),
  lng: z.number(),
  force_access: z.boolean().optional(),
});

async function getAppConfig() {
  const { data, error } = await supabase
    .from('app_config')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) {
    console.error('simulator.config_failed', error);
  }
  return data ?? null;
}

async function fetchDrivers(params: z.infer<typeof driverQuerySchema>) {
  const config = await getAppConfig();
  const radiusKm = params.radius_km ?? parseNumber(config?.search_radius_km, 5);
  const maxResults = params.max ?? parseNumber(config?.max_results, 10);

  const { data, error } = await supabase.rpc('recent_drivers_near', {
    in_lat: params.lat,
    in_lng: params.lng,
    in_vehicle_type: params.vehicle_type,
    in_radius_km: radiusKm,
    in_max: maxResults,
  });

  if (error) {
    console.error('simulator.drivers_rpc_failed', error);
    throw new Error('drivers_query_failed');
  }

  const drivers = Array.isArray(data) ? data : [];
  const refCodes = drivers.map((d) => d.ref_code).filter(Boolean) as string[];

  let profileByRef: Record<string, { user_id: string }> = {};
  if (refCodes.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, ref_code')
      .in('ref_code', refCodes);

    if (profileError) {
      console.warn('simulator.driver_profiles_failed', profileError);
    } else if (profiles) {
      profileByRef = profiles.reduce<Record<string, { user_id: string }>>((acc, profile) => {
        if (profile.ref_code) {
          acc[profile.ref_code] = { user_id: profile.user_id };
        }
        return acc;
      }, {});
    }
  }

  return drivers.map((driver) => ({
    user_id: profileByRef[driver.ref_code ?? '']?.user_id ?? '',
    vehicle_type: params.vehicle_type as VehicleType,
    last_seen: driver.last_seen,
    ref_code: driver.ref_code ?? undefined,
    whatsapp_e164: driver.whatsapp_e164 ?? undefined,
  }));
}

async function gateDriverAccess(driverRefCode?: string): Promise<
  | { access: false; reason: 'missing_driver_ref_code' | 'unknown_driver'; credits_left?: number; used_credit?: boolean }
  | { access: true; credits_left: number | null; used_credit: boolean; user_id: string }
> {
  if (!driverRefCode) {
    return { access: false, reason: 'missing_driver_ref_code' };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('ref_code', driverRefCode)
    .maybeSingle();

  if (error) {
    console.error('simulator.driver_lookup_failed', error);
    throw new Error('driver_lookup_failed');
  }

  if (!profile) {
    return { access: false, reason: 'unknown_driver' };
  }

  const { data: gating, error: gateError } = await supabase
    .rpc('gate_pro_feature', { _user_id: profile.user_id })
    .maybeSingle();

  if (gateError) {
    console.error('simulator.gate_failed', gateError);
    throw new Error('gating_failed');
  }

  if (!gating?.access) {
    return {
      access: false,
      reason: 'insufficient_credits',
      credits_left: gating?.credits_left ?? 0,
      used_credit: gating?.used_credit ?? false,
    };
  }

  return {
    access: true,
    used_credit: gating.used_credit ?? false,
    credits_left: gating.credits_left ?? 0,
    user_id: profile.user_id,
  };
}

async function fetchPassengers(params: z.infer<typeof passengerQuerySchema>) {
  const config = await getAppConfig();
  const radiusKm = params.radius_km ?? parseNumber(config?.search_radius_km, 5);
  const maxResults = params.max ?? parseNumber(config?.max_results, 10);

  let gateResult: Awaited<ReturnType<typeof gateDriverAccess>> = { access: true, credits_left: null, used_credit: false, user_id: '' } as any;

  if (!params.force_access) {
    gateResult = await gateDriverAccess(params.driver_ref_code);
    if (!gateResult.access) {
      return gateResult;
    }
  }

  const { data, error } = await supabase.rpc('recent_passenger_trips_near', {
    in_lat: params.lat,
    in_lng: params.lng,
    in_vehicle_type: params.vehicle_type,
    in_radius_km: radiusKm,
    in_max: maxResults,
  });

  if (error) {
    console.error('simulator.passengers_rpc_failed', error);
    throw new Error('passengers_query_failed');
  }

  const trips = Array.isArray(data) ? data : [];
  const tripIds = trips.map((trip) => trip.trip_id);

  if (tripIds.length === 0) {
    return {
      access: true,
      trips: [],
      used_credit: gateResult.used_credit ?? false,
      credits_left: gateResult.credits_left ?? null,
    } as const;
  }

  const { data: tripRows, error: tripError } = await supabase
    .from('trips')
    .select(`
      id,
      creator_user_id,
      role,
      vehicle_type,
      status,
      created_at,
      profiles!inner(ref_code, whatsapp_e164)
    `)
    .in('id', tripIds);

  if (tripError) {
    console.error('simulator.trip_lookup_failed', tripError);
    throw new Error('trip_lookup_failed');
  }

  const tripsById = new Map<number, any>();
  (tripRows ?? []).forEach((row) => {
    tripsById.set(row.id, row);
  });

  const resultTrips = tripIds.map((id) => {
    const row = tripsById.get(id);
    return {
      id,
      creator_user_id: row?.creator_user_id ?? '',
      role: (row?.role ?? 'passenger') as 'passenger' | 'driver',
      vehicle_type: (row?.vehicle_type ?? params.vehicle_type) as VehicleType,
      status: row?.status ?? 'open',
      created_at: row?.created_at ?? new Date().toISOString(),
      ref_code: row?.profiles?.ref_code ?? undefined,
      whatsapp_e164: row?.profiles?.whatsapp_e164 ?? undefined,
    };
  });

  return {
    access: true,
    trips: resultTrips,
    used_credit: gateResult.used_credit ?? false,
    credits_left: gateResult.credits_left ?? null,
  } as const;
}

async function fetchProfile(refCode: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, whatsapp_e164, ref_code, credits_balance, created_at')
    .eq('ref_code', refCode)
    .maybeSingle();

  if (error) {
    console.error('simulator.profile_lookup_failed', error);
    throw new Error('profile_lookup_failed');
  }

  return data ?? null;
}

function pointFromLatLng(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

async function schedulePassengerTrip(params: z.infer<typeof schedulePassengerSchema>) {
  const profile = await fetchProfile(params.ref_code);
  if (!profile) {
    return { error: 'unknown_passenger' } as const;
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      creator_user_id: profile.user_id,
      role: 'passenger',
      vehicle_type: params.vehicle_type,
      status: 'open',
      pickup: pointFromLatLng(params.lat, params.lng),
    })
    .select('id, creator_user_id, role, vehicle_type, status, created_at')
    .single();

  if (error) {
    console.error('simulator.schedule_passenger_failed', error);
    throw new Error('trip_insert_failed');
  }

  return {
    trip: {
      id: data.id,
      creator_user_id: data.creator_user_id,
      role: data.role as 'passenger' | 'driver',
      vehicle_type: data.vehicle_type as VehicleType,
      status: data.status ?? 'open',
      created_at: data.created_at ?? new Date().toISOString(),
      ref_code: profile.ref_code,
      whatsapp_e164: profile.whatsapp_e164,
      lat: params.lat,
      lng: params.lng,
    },
  } as const;
}

async function scheduleDriverTrip(params: z.infer<typeof scheduleDriverSchema>) {
  let gate: Awaited<ReturnType<typeof gateDriverAccess>>;
  if (params.force_access) {
    gate = { access: true, credits_left: null, used_credit: false, user_id: '' } as any;
  } else {
    gate = await gateDriverAccess(params.ref_code);
    if (!gate.access) {
      return gate;
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, whatsapp_e164, ref_code')
    .eq('ref_code', params.ref_code)
    .maybeSingle();

  if (profileError) {
    console.error('simulator.driver_lookup_failed', profileError);
    throw new Error('driver_lookup_failed');
  }

  if (!profile) {
    return { access: false, reason: 'unknown_driver' } as const;
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      creator_user_id: profile.user_id,
      role: 'driver',
      vehicle_type: params.vehicle_type,
      status: 'open',
      pickup: pointFromLatLng(params.lat, params.lng),
    })
    .select('id, creator_user_id, role, vehicle_type, status, created_at')
    .single();

  if (error) {
    console.error('simulator.schedule_driver_failed', error);
    throw new Error('trip_insert_failed');
  }

  const updateStatus = await supabase
    .from('driver_status')
    .upsert({
      user_id: profile.user_id,
      vehicle_type: params.vehicle_type,
      location: pointFromLatLng(params.lat, params.lng),
      last_seen: new Date().toISOString(),
      online: true,
    });

  if (updateStatus.error) {
    console.warn('simulator.driver_status_upsert_failed', updateStatus.error);
  }

  return {
    trip: {
      id: data.id,
      creator_user_id: data.creator_user_id,
      role: data.role as 'passenger' | 'driver',
      vehicle_type: data.vehicle_type as VehicleType,
      status: data.status ?? 'open',
      created_at: data.created_at ?? new Date().toISOString(),
      ref_code: profile.ref_code ?? undefined,
      whatsapp_e164: profile.whatsapp_e164 ?? undefined,
      lat: params.lat,
      lng: params.lng,
    },
    credits_left: gate.credits_left ?? null,
    used_credit: gate.used_credit ?? false,
  } as const;
}

Deno.serve(async (req) => {
  logRequest('simulator', req);

  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  const url = new URL(req.url);
  const action = (url.searchParams.get('action') ?? '').toLowerCase();

  try {
    if (req.method === 'GET' && action === 'drivers') {
      const parsed = driverQuerySchema.parse(Object.fromEntries(url.searchParams));
      const drivers = await fetchDrivers(parsed);
      logResponse('simulator.drivers', 200, { count: drivers.length });
      return json({ drivers });
    }

    if (req.method === 'GET' && action === 'passengers') {
      const parsed = passengerQuerySchema.parse(Object.fromEntries(url.searchParams));
      const result = await fetchPassengers(parsed);
      if (!result.access) {
        logResponse('simulator.passengers.denied', 200, { reason: result.reason });
        return json({ access: false, reason: result.reason, credits_left: result.credits_left, used_credit: result.used_credit ?? false });
      }

      logResponse('simulator.passengers', 200, { count: result.trips?.length ?? 0 });
      return json({ access: true, trips: result.trips, credits_left: result.credits_left, used_credit: result.used_credit ?? false });
    }

    if (req.method === 'GET' && action === 'profile') {
      const parsed = profileQuerySchema.parse(Object.fromEntries(url.searchParams));
      const profile = await fetchProfile(parsed.ref);
      logResponse('simulator.profile', 200, { found: Boolean(profile) });
      return json({ profile });
    }

    if (req.method === 'POST' && action === 'schedule_passenger') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return json({ error: 'invalid_json' }, 400);
      }
      const parsed = schedulePassengerSchema.parse(body);
      const result = await schedulePassengerTrip(parsed);
      if ('error' in result) {
        logResponse('simulator.schedule_passenger.denied', 200, { reason: result.error });
        return json({ error: result.error }, 400);
      }
      logResponse('simulator.schedule_passenger', 200, { id: result.trip.id });
      return json({ trip: result.trip });
    }

    if (req.method === 'POST' && action === 'schedule_driver') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return json({ error: 'invalid_json' }, 400);
      }
      const parsed = scheduleDriverSchema.parse(body);
      const result = await scheduleDriverTrip(parsed);
      if ('access' in result && !result.access) {
        logResponse('simulator.schedule_driver.denied', 200, { reason: result.reason });
        return json({ access: false, reason: result.reason, credits_left: result.credits_left, used_credit: result.used_credit ?? false });
      }
      logResponse('simulator.schedule_driver', 200, { id: result.trip.id });
      return json({ access: true, trip: result.trip, credits_left: result.credits_left ?? null, used_credit: result.used_credit ?? false });
    }

    return json({ error: 'invalid_action' }, 400);
  } catch (error) {
    console.error('simulator.unhandled', error);
    if (error instanceof z.ZodError) {
      return json({ error: 'invalid_request', details: error.flatten() }, 400);
    }
    if (error instanceof Error && error.message === 'drivers_query_failed') {
      return json({ error: 'drivers_query_failed' }, 500);
    }
    if (error instanceof Error && error.message === 'passengers_query_failed') {
      return json({ error: 'passengers_query_failed' }, 500);
    }
    if (error instanceof Error && error.message === 'gating_failed') {
      return json({ error: 'gating_failed' }, 500);
    }
    if (error instanceof Error && error.message === 'driver_lookup_failed') {
      return json({ error: 'driver_lookup_failed' }, 500);
    }
    if (error instanceof Error && error.message === 'trip_lookup_failed') {
      return json({ error: 'trip_lookup_failed' }, 500);
    }
    if (error instanceof Error && error.message === 'trip_insert_failed') {
      return json({ error: 'trip_insert_failed' }, 500);
    }
    if (error instanceof Error && error.message === 'profile_lookup_failed') {
      return json({ error: 'profile_lookup_failed' }, 500);
    }

    return json({ error: 'internal_error' }, 500);
  }
});
