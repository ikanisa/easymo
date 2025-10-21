import { z } from 'zod';
import { getServiceSupabaseClient } from '../../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../../_lib/http';
import { getFeatureFlag, resolveFeatureEnabled } from '../../../_lib/feature-flags';
import { requireAuth } from '../../../_lib/auth';

const schema = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  const auth = requireAuth(request, { requireRole: 'driver', allowAdmin: true });
  if (auth instanceof Response) return auth;

  let payloadRaw: unknown;
  try {
    payloadRaw = await request.json();
  } catch (error) {
    console.error('driver.availability.delete.invalid_json', error);
    return jsonError({ error: 'invalid_json' }, 400);
  }

  const parse = schema.safeParse(payloadRaw);
  if (!parse.success) {
    return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
  }

  const supabase = getServiceSupabaseClient();
  const flagValue = await getFeatureFlag(supabase, 'favorites.enabled', true);
  if (!resolveFeatureEnabled(flagValue, true)) {
    return jsonError({ error: 'feature_disabled' }, 404);
  }

  const { error } = await supabase
    .from('driver_availability')
    .delete()
    .eq('id', parse.data.id)
    .eq('driver_id', auth.userId);

  if (error) {
    console.error('driver.availability.delete_failed', error);
    return jsonError({ error: 'delete_failed' }, 500);
  }

  return jsonOk({ ok: true });
}
