import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../_lib/feature-flags';
import { requireAuth } from '../../_lib/auth';
import { parseGeography } from '../../_lib/locations';

export async function GET(request: Request) {
  const auth = requireAuth(request, { requireRole: 'user' });
  if (auth instanceof Response) return auth;

  const supabase = getServiceSupabaseClient();
  const flagValue = await getFeatureFlag(supabase, 'recurring_trips.enabled', true);
  if (!resolveFeatureEnabled(flagValue, true)) {
    return jsonError({ error: 'feature_disabled' }, 404);
  }

  const { data, error } = await supabase
    .from('recurring_trips')
    .select(`
      id,
      user_id,
      origin_favorite_id,
      dest_favorite_id,
      days_of_week,
      time_local,
      timezone,
      radius_km,
      active,
      last_triggered_at,
      created_at,
      updated_at,
      origin:origin_favorite_id(id, kind, label, address, geog, is_default),
      destination:dest_favorite_id(id, kind, label, address, geog, is_default)
    `)
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('recurring_trips.list_failed', error);
    return jsonError({ error: 'query_failed' }, 500);
  }

  const trips = (Array.isArray(data) ? data : []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    origin_favorite_id: row.origin_favorite_id,
    dest_favorite_id: row.dest_favorite_id,
    days_of_week: row.days_of_week,
    time_local: row.time_local,
    timezone: row.timezone,
    radius_km: Number(row.radius_km ?? 10),
    active: row.active,
    last_triggered_at: row.last_triggered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    origin: row.origin
      ? {
          id: row.origin.id,
          kind: row.origin.kind,
          label: row.origin.label,
          address: row.origin.address,
          is_default: row.origin.is_default,
          coordinates: parseGeography(row.origin.geog as any),
        }
      : null,
    destination: row.destination
      ? {
          id: row.destination.id,
          kind: row.destination.kind,
          label: row.destination.label,
          address: row.destination.address,
          is_default: row.destination.is_default,
          coordinates: parseGeography(row.destination.geog as any),
        }
      : null,
  }));

  return jsonOk({ trips });
}
