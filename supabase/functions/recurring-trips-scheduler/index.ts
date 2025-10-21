// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SERVICE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WINDOW_MINUTES = Number(Deno.env.get("RECURRING_TRIPS_WINDOW_MINUTES") ?? "5");
const CRON_EXPR = "*/1 * * * *";
const denoWithCron = Deno as typeof Deno & {
  cron?: (name: string, schedule: string, handler: () => void | Promise<void>) => void;
};
const CRON_ENABLED = (Deno.env.get("RECURRING_TRIPS_CRON_ENABLED") ?? "true").toLowerCase() !== "false";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("recurring-trips-scheduler missing Supabase configuration");
}

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_KEY ?? "");

function parsePoint(input: any): { lat: number; lng: number } | null {
  if (!input) return null;
  if (typeof input === "string") {
    const match = input.match(/POINT\\(([-0-9.]+) ([-0-9.]+)\)/i);
    if (match) {
      const [, lngRaw, latRaw] = match;
      const lng = Number(lngRaw);
      const lat = Number(latRaw);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { lat, lng };
      }
    }
    try {
      const parsed = JSON.parse(input);
      if (parsed && Array.isArray(parsed.coordinates) && parsed.coordinates.length === 2) {
        const [lng, lat] = parsed.coordinates;
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return { lat, lng };
        }
      }
    } catch (_error) {
      // ignore
    }
  }
  if (typeof input === "object" && input && Array.isArray(input.coordinates) && input.coordinates.length === 2) {
    const [lng, lat] = input.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lat, lng };
    }
  }
  return null;
}

async function shortlistTrip(trip: any) {
  const { data: favorites, error: favoriteError } = await supabase
    .from("user_favorites")
    .select("id, geog, kind, label")
    .in("id", [trip.origin_favorite_id, trip.dest_favorite_id]);

  if (favoriteError) {
    console.error("recurring-trips-scheduler.favorite_lookup_failed", favoriteError);
    return null;
  }

  const favoriteMap = new Map<string, any>();
  for (const fav of favorites ?? []) {
    favoriteMap.set(fav.id, fav);
  }

  const origin = favoriteMap.get(trip.origin_favorite_id);
  const destination = favoriteMap.get(trip.dest_favorite_id);

  if (!origin || !destination) {
    console.warn("recurring-trips-scheduler.favorite_missing", { trip_id: trip.id });
    return null;
  }

  const originCoords = parsePoint(origin.geog);
  const destinationCoords = parsePoint(destination.geog);
  if (!originCoords || !destinationCoords) {
    console.warn("recurring-trips-scheduler.invalid_coords", { trip_id: trip.id });
    return null;
  }

  const radius = Number(trip.radius_km ?? 10);

  const { data: liveData, error: liveError } = await supabase.rpc('search_live_market_candidates', {
    _actor_kind: 'passenger',
    _pickup_lat: originCoords.lat,
    _pickup_lng: originCoords.lng,
    _dropoff_lat: destinationCoords.lat,
    _dropoff_lng: destinationCoords.lng,
    _radius_km: radius,
    _limit: 20,
  });

  if (liveError) {
    console.error('recurring-trips-scheduler.live_failed', liveError);
  }

  const { data: parkingData, error: parkingError } = await supabase.rpc('search_driver_parking_candidates', {
    _pickup_lat: originCoords.lat,
    _pickup_lng: originCoords.lng,
    _dropoff_lat: destinationCoords.lat,
    _dropoff_lng: destinationCoords.lng,
    _radius_km: radius,
    _limit: 20,
  });

  if (parkingError) {
    console.error('recurring-trips-scheduler.parking_failed', parkingError);
  }

  const liveCount = Array.isArray(liveData) ? liveData.length : 0;
  const parkingCount = Array.isArray(parkingData) ? parkingData.length : 0;

  await supabase.rpc('record_recurring_trip_trigger', {
    _trip_id: trip.id,
    _triggered_at: new Date().toISOString(),
  });

  console.info('telemetry.match_from_favorite', {
    origin_kind: origin.kind,
    candidates: parkingCount,
  });

  return {
    trip_id: trip.id,
    live_candidates: liveCount,
    parking_candidates: parkingCount,
  };
}

async function runScheduler(trigger: 'http' | 'cron') {
  const now = new Date();
  const { data, error } = await supabase.rpc('find_due_recurring_trips', {
    _window_minutes: Number.isFinite(WINDOW_MINUTES) ? WINDOW_MINUTES : 5,
    _now: now.toISOString(),
  });

  if (error) {
    console.error('recurring-trips-scheduler.find_due_failed', error);
    return {
      ok: false,
      error: error.message,
    };
  }

  const trips = Array.isArray(data) ? data : [];
  const results = [] as Array<{ trip_id: string; live_candidates: number; parking_candidates: number }>;

  for (const trip of trips) {
    try {
      const outcome = await shortlistTrip(trip);
      if (outcome) {
        results.push(outcome);
      }
    } catch (taskError) {
      console.error('recurring-trips-scheduler.shortlist_failed', taskError);
    }
  }

  console.info('telemetry.broker_shortlist_generated', {
    request_id: crypto.randomUUID(),
    count: results.reduce((acc, item) => acc + item.parking_candidates + item.live_candidates, 0),
  });

  return {
    ok: true,
    trigger,
    processed: trips.length,
    shortlists: results,
  };
}

Deno.serve(async (_req) => {
  const summary = await runScheduler('http');
  return new Response(JSON.stringify(summary), {
    status: summary.ok ? 200 : 500,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
});

if (typeof denoWithCron.cron === 'function' && CRON_ENABLED) {
  denoWithCron.cron('recurring-trips-scheduler', CRON_EXPR, async () => {
    try {
      await runScheduler('cron');
    } catch (error) {
      console.error('recurring-trips-scheduler.cron_failed', error);
    }
  });
} else if (!CRON_ENABLED) {
  console.warn('recurring-trips-scheduler cron disabled via env');
}
