import { favoritePayloadSchema, buildFavoriteInsert, mapFavoriteRow, needsUnsetDefault } from '../utils';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { requireAuth } from '../../_lib/auth';
import { withRouteInstrumentation } from '../../_lib/observability';

export async function POST(request: Request) {
  return withRouteInstrumentation('favorites.create.POST', request, async ({ logger, traceId }) => {
    const auth = requireAuth(request, { requireRole: 'user' });
    if (auth instanceof Response) return auth;

    let payloadRaw: unknown;
    try {
      payloadRaw = await request.json();
    } catch (error) {
      logger.error({ event: 'favorites.create.invalid_json', err: error });
      return jsonError({ error: 'invalid_json' }, 400);
    }

    const parse = favoritePayloadSchema.safeParse(payloadRaw);
    if (!parse.success) {
      return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
    }

    const payload = parse.data;
    const supabase = getServiceSupabaseClient();

    const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
    if (!resolveFeatureEnabled(flagValue, true)) {
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const insertPayload = buildFavoriteInsert(auth.userId, payload);

    const { data, error } = await supabase
      .from('user_favorites')
      .insert(insertPayload)
      .select('id, user_id, kind, label, address, geog, is_default, created_at, updated_at')
      .single();

    if (error) {
      logger.error({ event: 'favorites.create.insert_failed', err: error });
      return jsonError({ error: 'insert_failed' }, 500);
    }

    if (needsUnsetDefault(payload)) {
      await supabase
        .from('user_favorites')
        .update({ is_default: false })
        .eq('user_id', auth.userId)
        .eq('kind', payload.kind)
        .neq('id', data.id);
    }

    logger.warn({ event: 'telemetry.favorite_created',
      user_id: auth.userId,
      kind: payload.kind,
    });

    return jsonOk({ favorite: mapFavoriteRow(data) }, 201);
  });
}
