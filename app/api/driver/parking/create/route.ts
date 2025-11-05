import { parkingCreateSchema, buildParkingInsert, mapParkingRow } from '../utils';
import { getServiceSupabaseClient } from '../../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../../_lib/feature-flags';
import { requireAuth } from '../../../_lib/auth';
import { withRouteInstrumentation } from '../../../_lib/observability';

export async function POST(request: Request) {
  return withRouteInstrumentation('driver.parking.create.POST', request, async ({ logger, traceId }) => {
    const auth = requireAuth(request, { requireRole: 'driver', allowAdmin: true });
    if (auth instanceof Response) return auth;

    let payloadRaw: unknown;
    try {
      payloadRaw = await request.json();
    } catch (error) {
      logger.error({ event: 'driver.parking.create.invalid_json', err: error });
      return jsonError({ error: 'invalid_json' }, 400);
    }

    const parse = parkingCreateSchema.safeParse(payloadRaw);
    if (!parse.success) {
      return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
    }

    const supabase = getServiceSupabaseClient();
    const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
    if (!resolveFeatureEnabled(flagValue, true)) {
      return jsonError({ error: 'feature_disabled' }, 404);
    }

    const insertPayload = buildParkingInsert(auth.userId, parse.data);
    const { data, error } = await supabase
      .from('driver_parking')
      .insert(insertPayload)
      .select('id, driver_id, label, geog, active, created_at, updated_at')
      .single();

    if (error) {
      logger.error({ event: 'driver.parking.create_failed', err: error });
      return jsonError({ error: 'insert_failed' }, 500);
    }

    logger.warn({ event: 'telemetry.driver_parking_created',
      driver_id: auth.userId,
      label: parse.data.label,
    });

    return jsonOk({ parking: mapParkingRow(data) }, 201);
  });
}
