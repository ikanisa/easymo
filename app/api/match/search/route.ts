import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag } from '../../_lib/feature-flags';

const requestSchema = z.object({
  actor_kind: z.enum(['driver', 'passenger']),
  pickup: z.object({ lat: z.number(), lng: z.number() }),
  dropoff: z.object({ lat: z.number(), lng: z.number() }).optional(),
  radius_km: z.number().positive().max(50).default(10),
  limit: z.number().int().min(1).max(50).default(20),
});

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    console.error('match.search.invalid_payload', error);
    return jsonError({ error: 'invalid_payload' }, 400);
  }

  const supabase = getServiceSupabaseClient();

  const dualConstraintValue = await getFeatureFlag(
    supabase,
    'dualConstraintMatching.enabled',
    true,
  );
  const dualConstraintEnabled = Boolean(
    typeof dualConstraintValue === 'boolean'
      ? dualConstraintValue
      : (dualConstraintValue as { enabled?: boolean })?.enabled ?? true,
  );

  const hasDropoff = Boolean(body.dropoff && dualConstraintEnabled);

  const { data, error } = await supabase.rpc('search_live_market_candidates', {
    _actor_kind: body.actor_kind,
    _pickup_lat: body.pickup.lat,
    _pickup_lng: body.pickup.lng,
    _dropoff_lat: hasDropoff ? body.dropoff!.lat : null,
    _dropoff_lng: hasDropoff ? body.dropoff!.lng : null,
    _radius_km: body.radius_km,
    _limit: body.limit,
  });

  if (error) {
    console.error('match.search.query_failed', error);
    return jsonError({ error: 'query_failed' }, 500);
  }

  const candidates = (Array.isArray(data) ? data : []).map((row) => ({
    id: row.candidate_id,
    kind: row.candidate_kind,
    user_id: row.candidate_user_id,
    pickup_distance_km: Number(row.pickup_distance_km ?? 0),
    dropoff_distance_km: row.dropoff_distance_km != null
      ? Number(row.dropoff_distance_km)
      : null,
    created_at: row.created_at,
  }));

  console.info('match.search.completed', {
    actor_kind: body.actor_kind,
    radius_km: body.radius_km,
    has_dropoff: hasDropoff,
    candidate_count: candidates.length,
  });

  return jsonOk({ candidates });
}
