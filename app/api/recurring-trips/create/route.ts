import { recurringTripCreateSchema, buildRecurringTripInsert } from '../utils';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { requireAuth } from '../../_lib/auth';
import { withRouteInstrumentation } from '../../_lib/observability';

export async function POST(request: Request) {
  return withRouteInstrumentation('recurring-trips.create.POST', request, async ({ logger, traceId }) => {
    const auth = requireAuth(request, { requireRole: 'user' });
    if (auth instanceof Response) return auth;

    let payloadRaw: unknown;
    try {
      payloadRaw = await request.json();
    } catch (error) {
      logger.error({ event: 'recurring_trips.create.invalid_json', err: error });
      return jsonError({ error: 'invalid_json' }, 400);
    }

    const parse = recurringTripCreateSchema.safeParse(payloadRaw);
    if (!parse.success) {
      return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
    }

    const supabase = getServiceSupabaseClient();
    const flagValue = await getFeatureFlag(supabase, 'recurring_trips.enabled', true);
    if (!resolveFeatureEnabled(flagValue, true)) {
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const favoriteIds = [parse.data.origin_favorite_id, parse.data.dest_favorite_id];
    const { data: favorites, error: favoritesError } = await supabase
      .from('user_favorites')
      .select('id, user_id')
      .in('id', favoriteIds);

    if (favoritesError) {
      logger.error({ event: 'recurring_trips.create.favorite_lookup_failed', err: favoritesError });
      return jsonError({ error: 'favorite_lookup_failed' }, 500);
    }

    const ownedFavorites = new Set((favorites ?? []).filter((fav) => fav.user_id === auth.userId).map((fav) => fav.id));
    if (!favoriteIds.every((id) => ownedFavorites.has(id))) {
      return jsonError({ error: 'favorite_not_owned' }, 403);
    }

    const insertPayload = buildRecurringTripInsert(auth.userId, parse.data);
    const { data, error } = await supabase
      .from('recurring_trips')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      logger.error({ event: 'recurring_trips.create_failed', err: error });
      return jsonError({ error: 'insert_failed' }, 500);
    }

    logger.warn({ event: 'telemetry.recurring_trip_created',
      user_id: auth.userId,
      days_of_week: parse.data.days_of_week,
      time_local: parse.data.time_local,
    });

    return jsonOk({ trip: data }, 201);
  });
}
