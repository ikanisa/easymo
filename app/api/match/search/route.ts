import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { getAuthContext } from '../../_lib/auth';
import type { FavoriteRow } from './helpers';
import { buildMatchLocations, normalizeRadius, shouldApplyDualConstraint } from './helpers';
import { withRouteInstrumentation } from '../../_lib/observability';

const locationSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const requestSchema = z.object({
  actor_kind: z.enum(['driver', 'passenger']),
  pickup: locationSchema.optional(),
  dropoff: locationSchema.optional(),
  origin_favorite_id: z.string().uuid().optional(),
  dest_favorite_id: z.string().uuid().optional(),
  radius_km: z.number().positive().max(50).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

type LiveCandidate = {
  id: string;
  kind: string;
  user_id: string;
  pickup_distance_km: number;
  dropoff_distance_km: number | null;
  created_at: string | null;
  source?: 'live' | 'parking';
  availability_fits?: boolean;
  rank_score?: number | null;
};

export async function POST(request: Request) {
  return withRouteInstrumentation('match.search.POST', request, async ({ logger, traceId }) => {
    const supabase = getServiceSupabaseClient();
    const auth = getAuthContext(request);

    let body: z.infer<typeof requestSchema>;
    try {
      body = requestSchema.parse(await request.json());
    } catch (error) {
      logger.error({ event: 'match.search.invalid_payload', err: error });
      return jsonError({ error: 'invalid_payload' }, 400);
    }

    const dualConstraintFlag = await getFeatureFlag(supabase, 'dualConstraintMatching.enabled', true);
    const dualConstraintEnabled = resolveFeatureEnabled(dualConstraintFlag, true);
    const favoritesFlag = await getFeatureFlag(supabase, 'favorites.enabled', true);
    const favoritesEnabled = resolveFeatureEnabled(favoritesFlag, true);
    const brokerFavoritesFlag = await getFeatureFlag(supabase, 'broker.favorites_match.enabled', true);
    const favoritesMatchingEnabled = resolveFeatureEnabled(brokerFavoritesFlag, true);

    const favoriteIds: string[] = [];
    if (body.origin_favorite_id) favoriteIds.push(body.origin_favorite_id);
    if (body.dest_favorite_id) favoriteIds.push(body.dest_favorite_id);

    let originFavorite: FavoriteRow | null = null;
    let destinationFavorite: FavoriteRow | null = null;

    if (favoriteIds.length > 0) {
      if (!favoritesEnabled) {
        return jsonError({ error: 'favorites_disabled' }, 400);
      }
      if (!auth) {
        return jsonError({ error: 'unauthorized' }, 401);
      }

      const { data: favoriteRows, error: favoriteError } = await supabase
        .from('user_favorites')
        .select('id, user_id, kind, label, geog')
        .in('id', favoriteIds);

      if (favoriteError) {
        logger.error({ event: 'match.search.favorite_lookup_failed', err: favoriteError });
        return jsonError({ error: 'favorite_lookup_failed' }, 500);
      }

      for (const row of favoriteRows ?? []) {
        if (row.user_id !== auth.userId) {
          return jsonError({ error: 'favorite_not_owned' }, 403);
        }
        if (row.id === body.origin_favorite_id) {
          originFavorite = row as FavoriteRow;
        }
        if (row.id === body.dest_favorite_id) {
          destinationFavorite = row as FavoriteRow;
        }
      }

      if (body.origin_favorite_id && !originFavorite) {
        return jsonError({ error: 'favorite_not_found' }, 404);
      }
      if (body.dest_favorite_id && !destinationFavorite) {
        return jsonError({ error: 'favorite_not_found' }, 404);
      }
    }

    const pickupInput = body.pickup ?? null;
    const dropoffInput = body.dropoff ?? null;
    const locations = buildMatchLocations(pickupInput, dropoffInput, originFavorite, destinationFavorite);
    if (!locations) {
      return jsonError({ error: 'pickup_required' }, 400);
    }

    const radius = normalizeRadius(body.radius_km, 10);
    const limit = body.limit ?? 20;
    const hasDropoff = shouldApplyDualConstraint(locations.dropoff, dualConstraintEnabled);

    const { data, error } = await supabase.rpc('search_live_market_candidates', {
      _actor_kind: body.actor_kind,
      _pickup_lat: locations.pickup.lat,
      _pickup_lng: locations.pickup.lng,
      _dropoff_lat: hasDropoff && locations.dropoff ? locations.dropoff.lat : null,
      _dropoff_lng: hasDropoff && locations.dropoff ? locations.dropoff.lng : null,
      _radius_km: radius,
      _limit: limit,
    });

    if (error) {
      logger.error({ event: 'match.search.query_failed', err: error });
      return jsonError({ error: 'query_failed' }, 500);
    }

    const liveCandidates: LiveCandidate[] = (Array.isArray(data) ? data : []).map((row) => ({
      id: row.candidate_id ?? row.id,
      kind: row.candidate_kind ?? 'driver',
      user_id: row.candidate_user_id ?? row.user_id ?? row.id,
      pickup_distance_km: Number(row.pickup_distance_km ?? 0),
      dropoff_distance_km: row.dropoff_distance_km != null ? Number(row.dropoff_distance_km) : null,
      created_at: row.created_at ?? null,
      source: 'live',
    }));

    const combined = [...liveCandidates];

    let parkingCandidates: LiveCandidate[] = [];

    if (
      favoritesEnabled &&
      favoritesMatchingEnabled &&
      body.actor_kind === 'passenger'
    ) {
      const { data: parkingData, error: parkingError } = await supabase.rpc('search_driver_parking_candidates', {
        _pickup_lat: locations.pickup.lat,
        _pickup_lng: locations.pickup.lng,
        _dropoff_lat: locations.dropoff ? locations.dropoff.lat : null,
        _dropoff_lng: locations.dropoff ? locations.dropoff.lng : null,
        _radius_km: radius,
        _limit: limit,
      });

      if (parkingError) {
        logger.error({ event: 'match.search.parking_failed', err: parkingError });
      } else if (Array.isArray(parkingData)) {
        parkingCandidates = parkingData.map((row: any) => ({
          id: row.parking_id ?? row.id,
          kind: 'driver',
          user_id: row.driver_id ?? row.user_id,
          pickup_distance_km: Number(row.pickup_distance_km ?? 0),
          dropoff_distance_km: row.dropoff_distance_km != null ? Number(row.dropoff_distance_km) : null,
          created_at: null,
          source: 'parking',
          availability_fits: Boolean(row.availability_fits ?? true),
          rank_score: row.rank_score != null ? Number(row.rank_score) : null,
        }));

        const seen = new Set(combined.map((c) => c.id));
        for (const candidate of parkingCandidates) {
          if (candidate.user_id && combined.some((c) => c.user_id === candidate.user_id && c.source === 'live')) {
            const existingIndex = combined.findIndex((c) => c.user_id === candidate.user_id && c.source === 'live');
            if (existingIndex >= 0) {
              combined[existingIndex] = {
                ...combined[existingIndex],
                ...candidate,
              };
              continue;
            }
          }
          if (!seen.has(candidate.id)) {
            combined.push(candidate);
            seen.add(candidate.id);
          }
        }
      }
    }

    combined.sort((a, b) => {
      const scoreA = a.rank_score ?? a.pickup_distance_km;
      const scoreB = b.rank_score ?? b.pickup_distance_km;
      if (scoreA === scoreB) {
        return a.pickup_distance_km - b.pickup_distance_km;
      }
      return scoreA - scoreB;
    });

    if (originFavorite || destinationFavorite) {
      logger.warn({ event: 'telemetry.favorite_used_for_match',
        user_id: auth?.userId,
        origin_kind: originFavorite?.kind,
        destination_kind: destinationFavorite?.kind,
      });
    }

    if (parkingCandidates.length > 0) {
      logger.warn({ event: 'telemetry.match_from_favorite',
        origin_kind: originFavorite?.kind ?? null,
        candidates: parkingCandidates.length,
      });
    }

    logger.warn({ event: 'match.search.completed',
      actor_kind: body.actor_kind,
      radius_km: radius,
      has_dropoff: Boolean(locations.dropoff),
      candidate_count: combined.length,
    });

    return jsonOk({ candidates: combined });
  });
}
