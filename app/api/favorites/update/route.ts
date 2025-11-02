import { favoriteUpdateSchema, buildFavoriteUpdate, mapFavoriteRow, needsUnsetDefault } from '../utils';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { requireAuth } from '../../_lib/auth';
import { withRouteInstrumentation } from '../../_lib/observability';

export async function POST(request: Request) {
  return withRouteInstrumentation('favorites.update.POST', request, async ({ logger, traceId }) => {
    const auth = requireAuth(request, { requireRole: 'user' });
    if (auth instanceof Response) return auth;

    let payloadRaw: unknown;
    try {
      payloadRaw = await request.json();
    } catch (error) {
      logger.error({ event: 'favorites.update.invalid_json', err: error });
      return jsonError({ error: 'invalid_json' }, 400);
    }

    const parse = favoriteUpdateSchema.safeParse(payloadRaw);
    if (!parse.success) {
      return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
    }

    const payload = parse.data;
    const supabase = getServiceSupabaseClient();

    const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
    if (!resolveFeatureEnabled(flagValue, true)) {
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const { data: existing, error: fetchError } = await supabase
      .from('user_favorites')
      .select('id, user_id, kind')
      .eq('id', payload.id)
      .maybeSingle();

    if (fetchError) {
      logger.error({ event: 'favorites.update.fetch_failed', err: fetchError });
      return jsonError({ error: 'fetch_failed' }, 500);
    }
    if (!existing || existing.user_id !== auth.userId) {
      return jsonError({ error: 'not_found' }, 404);
    }

    const updatePayload = buildFavoriteUpdate(payload);
    if (Object.keys(updatePayload).length === 0) {
      return jsonOk({ ok: true, favorite: null });
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .update(updatePayload)
      .eq('id', payload.id)
      .eq('user_id', auth.userId)
      .select('id, user_id, kind, label, address, geog, is_default, created_at, updated_at')
      .single();

    if (error) {
      logger.error({ event: 'favorites.update.update_failed', err: error });
      return jsonError({ error: 'update_failed' }, 500);
    }

    if (needsUnsetDefault(payload)) {
      await supabase
        .from('user_favorites')
        .update({ is_default: false })
        .eq('user_id', auth.userId)
        .eq('kind', existing.kind)
        .neq('id', payload.id);
    }

    return jsonOk({ favorite: mapFavoriteRow(data) });
  });
}
