import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { getAuthContext } from '../../_lib/auth';
import { mapFavoriteRow } from '../utils';
import { withRouteInstrumentation } from '../../_lib/observability';

const querySchema = z.object({
  kind: z.enum(['home', 'work', 'school', 'other']).optional(),
});

export async function GET(request: Request) {
  return withRouteInstrumentation('favorites.list.GET', request, async ({ logger, traceId }) => {
    const auth = getAuthContext(request);
    if (!auth) {
      return jsonError({ error: 'unauthorized' }, 401);
    }

    const supabase = getServiceSupabaseClient();
    const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
    if (!resolveFeatureEnabled(flagValue, true)) {
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const url = new URL(request.url);
    const parse = querySchema.safeParse({ kind: url.searchParams.get('kind') ?? undefined });
    if (!parse.success) {
      return jsonError({ error: 'invalid_query', details: parse.error.flatten() }, 400);
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .select('id, user_id, kind, label, address, geog, is_default, created_at, updated_at')
      .eq('user_id', auth.userId)
      .order('kind', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ event: 'favorites.list.query_failed', error });
      return jsonError({ error: 'query_failed' }, 500);
    }

    let rows = Array.isArray(data) ? data : [];
    if (parse.data.kind) {
      rows = rows.filter((row) => row.kind === parse.data.kind);
    }

    const favorites = rows.map(mapFavoriteRow);
    return jsonOk({ favorites });
  });
}
