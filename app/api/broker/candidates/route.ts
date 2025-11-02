import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { requireAuth } from '../../_lib/auth';
import { withRouteInstrumentation } from '../../_lib/observability';

const payloadSchema = z.object({
  origin: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  dest: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  when: z.string().datetime({ offset: true }).optional(),
  radius_km: z.number().positive().max(50).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  return withRouteInstrumentation('broker.candidates.POST', request, async ({ request: scopedRequest, logger, traceId }) => {
    const auth = requireAuth(scopedRequest, { requireRole: 'admin' });
    if (auth instanceof Response) return auth;

    let payloadRaw: unknown;
    try {
      payloadRaw = await scopedRequest.json();
    } catch (error) {
      logger.warn({ event: 'broker.candidates.invalid_json', err: error });
      return jsonError({ error: 'invalid_json' }, 400);
    }

    const parse = payloadSchema.safeParse(payloadRaw);
    if (!parse.success) {
      logger.warn({ event: 'broker.candidates.invalid_payload', issues: parse.error.flatten() });
      return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
    }

    const payload = parse.data;
    const supabase = getServiceSupabaseClient();

    const favoritesFlag = await getFeatureFlag(supabase, 'favorites.enabled', true);
    const favoritesEnabled = resolveFeatureEnabled(favoritesFlag, true);
    const brokerFlag = await getFeatureFlag(supabase, 'broker.favorites_match.enabled', true);
    if (!favoritesEnabled || !resolveFeatureEnabled(brokerFlag, true)) {
      logger.info({ event: 'broker.candidates.feature_disabled', favoritesEnabled, brokerFlag });
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const radius = payload.radius_km ?? 10;
    const limit = payload.limit ?? 20;
    const targetTime = payload.when ? new Date(payload.when) : new Date();

    if (Number.isNaN(targetTime.getTime())) {
      logger.warn({ event: 'broker.candidates.invalid_when', when: payload.when });
      return jsonError({ error: 'invalid_when' }, 400);
    }

    const { data: parkingData, error: parkingError } = await supabase.rpc('search_driver_parking_candidates', {
      _pickup_lat: payload.origin.lat,
      _pickup_lng: payload.origin.lng,
      _dropoff_lat: payload.dest?.lat ?? null,
      _dropoff_lng: payload.dest?.lng ?? null,
      _radius_km: radius,
      _when: targetTime.toISOString(),
      _limit: limit,
    });

    if (parkingError) {
      logger.error({ event: 'broker.candidates.parking_failed', err: parkingError });
      return jsonError({ error: 'parking_query_failed' }, 500);
    }

    const { data: liveData, error: liveError } = await supabase.rpc('search_live_market_candidates', {
      _actor_kind: 'passenger',
      _pickup_lat: payload.origin.lat,
      _pickup_lng: payload.origin.lng,
      _dropoff_lat: payload.dest ? payload.dest.lat : null,
      _dropoff_lng: payload.dest ? payload.dest.lng : null,
      _radius_km: radius,
      _limit: limit,
    });

    if (liveError) {
      logger.error({ event: 'broker.candidates.live_failed', err: liveError });
      return jsonError({ error: 'live_query_failed' }, 500);
    }

    const combined = new Map<string, {
      id: string;
      user_id: string;
      source: 'live' | 'parking';
      pickup_distance_km: number;
      dropoff_distance_km: number | null;
      availability_fits?: boolean;
      recency_hours?: number | null;
      rank_score?: number | null;
    }>();

    if (Array.isArray(liveData)) {
      for (const row of liveData as any[]) {
        const userId = row.candidate_user_id ?? row.user_id ?? row.id;
        if (!userId) continue;
        const pickupDistance = Number(row.pickup_distance_km ?? row.pickup_km ?? 0);
        const dropoffDistance = row.dropoff_distance_km != null ? Number(row.dropoff_distance_km) : null;
        const existing = combined.get(userId);
        if (!existing || pickupDistance < existing.pickup_distance_km) {
          combined.set(userId, {
            id: row.candidate_id ?? row.id ?? randomUUID(),
            user_id: userId,
            source: 'live',
            pickup_distance_km: pickupDistance,
            dropoff_distance_km: dropoffDistance,
          });
        }
      }
    }

    if (Array.isArray(parkingData)) {
      for (const row of parkingData as any[]) {
        const userId = row.driver_id ?? row.user_id;
        if (!userId) continue;
        const pickupDistance = Number(row.pickup_distance_km ?? 0);
        const dropoffDistance = row.dropoff_distance_km != null ? Number(row.dropoff_distance_km) : null;
        const candidate = {
          id: row.parking_id ?? randomUUID(),
          user_id: userId,
          source: 'parking' as const,
          pickup_distance_km: pickupDistance,
          dropoff_distance_km: dropoffDistance,
          availability_fits: Boolean(row.availability_fits ?? true),
          recency_hours: row.recency_hours != null ? Number(row.recency_hours) : null,
          rank_score: row.rank_score != null ? Number(row.rank_score) : null,
        };

        const existing = combined.get(userId);
        if (!existing) {
          combined.set(userId, candidate);
        } else if (existing.source === 'live') {
          combined.set(userId, { ...existing, ...candidate });
        } else {
          const existingScore = existing.rank_score ?? existing.pickup_distance_km;
          const candidateScore = candidate.rank_score ?? candidate.pickup_distance_km;
          if (candidateScore < existingScore) {
            combined.set(userId, candidate);
          }
        }
      }
    }

    const candidates = Array.from(combined.values()).sort((a, b) => {
      const scoreA = a.rank_score ?? a.pickup_distance_km;
      const scoreB = b.rank_score ?? b.pickup_distance_km;
      if (scoreA === scoreB) {
        return a.pickup_distance_km - b.pickup_distance_km;
      }
      return scoreA - scoreB;
    });

    logger.info({
      event: 'telemetry.broker_shortlist_generated',
      request_id: traceId,
      count: candidates.length,
      radius_km: radius,
      has_dropoff: Boolean(payload.dest),
    });

    return jsonOk({ request_id: traceId, candidates });
  });
}
