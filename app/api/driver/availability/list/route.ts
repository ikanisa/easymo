import { getServiceSupabaseClient } from '../../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../../_lib/feature-flags';
import { requireAuth } from '../../../_lib/auth';
import { mapAvailabilityRow } from '../utils';

export async function GET(request: Request) {
  const auth = requireAuth(request, { requireRole: 'driver', allowAdmin: true });
  if (auth instanceof Response) return auth;

  const supabase = getServiceSupabaseClient();
  const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
  if (!resolveFeatureEnabled(flagValue, true)) {
    return jsonError({ error: 'feature_disabled' }, 404);
  }

  const url = new URL(request.url);
  const parkingId = url.searchParams.get('parking_id');

  const query = supabase
    .from('driver_availability')
    .select('id, driver_id, parking_id, days_of_week, start_time_local, end_time_local, timezone, active, created_at, updated_at')
    .eq('driver_id', auth.userId)
    .order('created_at', { ascending: false });

  if (parkingId) {
    query.eq('parking_id', parkingId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('driver.availability.list_failed', error);
    return jsonError({ error: 'query_failed' }, 500);
  }

  const availability = (Array.isArray(data) ? data : []).map(mapAvailabilityRow);
  return jsonOk({ availability });
}
