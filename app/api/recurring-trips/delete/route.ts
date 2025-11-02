import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { requireAuth } from '../../_lib/auth';
import { withRouteInstrumentation } from '../../_lib/observability';

const schema = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  return withRouteInstrumentation('recurring-trips.delete.POST', request, async ({ logger, traceId }) => {
    const auth = requireAuth(request, { requireRole: 'user' });
    if (auth instanceof Response) return auth;

    let payloadRaw: unknown;
    try {
      payloadRaw = await request.json();
    } catch (error) {
      logger.error({ event: 'recurring_trips.delete.invalid_json', err: error });
      return jsonError({ error: 'invalid_json' }, 400);
    }

    const parse = schema.safeParse(payloadRaw);
    if (!parse.success) {
      return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
    }

    const supabase = getServiceSupabaseClient();
    const flagValue = await getFeatureFlag(supabase, 'recurring_trips.enabled', true);
    if (!resolveFeatureEnabled(flagValue, true)) {
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const { error } = await supabase
      .from('recurring_trips')
      .delete()
      .eq('id', parse.data.id)
      .eq('user_id', auth.userId);

    if (error) {
      logger.error({ event: 'recurring_trips.delete_failed', err: error });
      return jsonError({ error: 'delete_failed' }, 500);
    }

    return jsonOk({ ok: true });
  });
}
