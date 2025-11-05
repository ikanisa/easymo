import { getServiceSupabaseClient } from '../../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../../_lib/feature-flags';
import { requireAuth } from '../../../_lib/auth';
import { mapParkingRow } from '../utils';
import { withRouteInstrumentation } from '../../../_lib/observability';

export async function GET(request: Request) {
  return withRouteInstrumentation('driver.parking.list.GET', request, async ({ logger, traceId }) => {
    const auth = requireAuth(request, { requireRole: 'driver', allowAdmin: true });
    if (auth instanceof Response) return auth;

    const supabase = getServiceSupabaseClient();
    const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
    if (!resolveFeatureEnabled(flagValue, true)) {
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const { data, error } = await supabase
      .from('driver_parking')
      .select('id, driver_id, label, geog, active, created_at, updated_at')
      .eq('driver_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ event: 'driver.parking.list_failed', err: error });
      return jsonError({ error: 'query_failed' }, 500);
    }

    const parkings = (Array.isArray(data) ? data : []).map(mapParkingRow);
    return jsonOk({ parkings });
  });
}
