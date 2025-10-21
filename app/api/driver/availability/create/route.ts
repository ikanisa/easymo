import { availabilityCreateSchema, buildAvailabilityInsert, mapAvailabilityRow } from '../utils';
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
    console.error('driver.availability.create.invalid_json', error);
    return jsonError({ error: 'invalid_json' }, 400);
  }

  const parse = availabilityCreateSchema.safeParse(payloadRaw);
  if (!parse.success) {
    return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
  }

  const supabase = getServiceSupabaseClient();
  const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
  if (!resolveFeatureEnabled(flagValue, true)) {
    return jsonError({ error: 'feature_disabled' }, 404);
  }

  const insertPayload = buildAvailabilityInsert(auth.userId, parse.data);
  const { data, error } = await supabase
    .from('driver_availability')
    .insert(insertPayload)
    .select('id, driver_id, parking_id, days_of_week, start_time_local, end_time_local, timezone, active, created_at, updated_at')
    .single();

  if (error) {
    console.error('driver.availability.create_failed', error);
    return jsonError({ error: 'insert_failed' }, 500);
  }

  console.warn('telemetry.driver_availability_set', {
    driver_id: auth.userId,
    days: parse.data.days_of_week,
    start_time: parse.data.start_time_local,
    end_time: parse.data.end_time_local,
  });

  return jsonOk({ availability: mapAvailabilityRow(data) }, 201);
}
