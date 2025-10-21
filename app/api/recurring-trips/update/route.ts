import { recurringTripUpdateSchema, buildRecurringTripUpdate } from '../utils';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { requireAuth } from '../../_lib/auth';

export async function POST(request: Request) {
  const auth = requireAuth(request, { requireRole: 'user' });
  if (auth instanceof Response) return auth;

  let payloadRaw: unknown;
  try {
    payloadRaw = await request.json();
  } catch (error) {
    console.error('recurring_trips.update.invalid_json', error);
    return jsonError({ error: 'invalid_json' }, 400);
  }

  const parse = recurringTripUpdateSchema.safeParse(payloadRaw);
  if (!parse.success) {
    return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
  }

  const supabase = getServiceSupabaseClient();
  const flagValue = await getFeatureFlag(supabase, 'recurring_trips.enabled', true);
  if (!resolveFeatureEnabled(flagValue, true)) {
    return jsonError({ error: 'feature_disabled' }, 404);
  }

  const { data: existing, error: fetchError } = await supabase
    .from('recurring_trips')
    .select('id, user_id')
    .eq('id', parse.data.id)
    .maybeSingle();

  if (fetchError) {
    console.error('recurring_trips.update.fetch_failed', fetchError);
    return jsonError({ error: 'fetch_failed' }, 500);
  }

  if (!existing || existing.user_id !== auth.userId) {
    return jsonError({ error: 'not_found' }, 404);
  }

  const favoriteIds = [parse.data.origin_favorite_id, parse.data.dest_favorite_id].filter(Boolean) as string[];
  if (favoriteIds.length > 0) {
    const { data: favorites, error: favoriteError } = await supabase
      .from('user_favorites')
      .select('id, user_id')
      .in('id', favoriteIds);

    if (favoriteError) {
      console.error('recurring_trips.update.favorite_lookup_failed', favoriteError);
      return jsonError({ error: 'favorite_lookup_failed' }, 500);
    }

    const ownedFavorites = new Set((favorites ?? []).filter((fav) => fav.user_id === auth.userId).map((fav) => fav.id));
    if (!favoriteIds.every((id) => ownedFavorites.has(id))) {
      return jsonError({ error: 'favorite_not_owned' }, 403);
    }
  }

  const updatePayload = buildRecurringTripUpdate(parse.data);
  if (Object.keys(updatePayload).length === 0) {
    return jsonOk({ ok: true, trip: null });
  }

  const { data, error } = await supabase
    .from('recurring_trips')
    .update(updatePayload)
    .eq('id', parse.data.id)
    .eq('user_id', auth.userId)
    .select('*')
    .single();

  if (error) {
    console.error('recurring_trips.update_failed', error);
    return jsonError({ error: 'update_failed' }, 500);
  }

  return jsonOk({ trip: data });
}
