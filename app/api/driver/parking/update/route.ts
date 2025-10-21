import { parkingUpdateSchema, buildParkingUpdate, mapParkingRow } from '../utils';
import { getServiceSupabaseClient } from '../../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../../_lib/feature-flags';
import { requireAuth } from '../../../_lib/auth';

export async function POST(request: Request) {
  const auth = requireAuth(request, { requireRole: 'driver', allowAdmin: true });
  if (auth instanceof Response) return auth;

  let payloadRaw: unknown;
  try {
    payloadRaw = await request.json();
  } catch (error) {
    console.error('driver.parking.update.invalid_json', error);
    return jsonError({ error: 'invalid_json' }, 400);
  }

  const parse = parkingUpdateSchema.safeParse(payloadRaw);
  if (!parse.success) {
    return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
  }

  const supabase = getServiceSupabaseClient();
  const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
  if (!resolveFeatureEnabled(flagValue, true)) {
    return jsonError({ error: 'feature_disabled' }, 404);
  }

  const { data: existing, error: fetchError } = await supabase
    .from('driver_parking')
    .select('id, driver_id')
    .eq('id', parse.data.id)
    .maybeSingle();

  if (fetchError) {
    console.error('driver.parking.update.fetch_failed', fetchError);
    return jsonError({ error: 'fetch_failed' }, 500);
  }

  if (!existing || existing.driver_id !== auth.userId) {
    return jsonError({ error: 'not_found' }, 404);
  }

  const updatePayload = buildParkingUpdate(parse.data);
  if (Object.keys(updatePayload).length === 0) {
    return jsonOk({ ok: true, parking: null });
  }

  const { data, error } = await supabase
    .from('driver_parking')
    .update(updatePayload)
    .eq('id', parse.data.id)
    .eq('driver_id', auth.userId)
    .select('id, driver_id, label, geog, active, created_at, updated_at')
    .single();

  if (error) {
    console.error('driver.parking.update_failed', error);
    return jsonError({ error: 'update_failed' }, 500);
  }

  return jsonOk({ parking: mapParkingRow(data) });
}
