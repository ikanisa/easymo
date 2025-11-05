import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { withRouteInstrumentation } from '../../_lib/observability';

const querySchema = z.object({
  t: z.string().min(4),
});

export async function GET(request: Request) {
  return withRouteInstrumentation('deeplink.join.GET', request, async ({ logger, traceId }) => {
    const supabase = getServiceSupabaseClient();
    const url = new URL(request.url);

    const parse = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parse.success) {
      return jsonError({ error: 'token_required' }, 400);
    }

    const token = parse.data.t.trim();

    const { data, error } = await supabase
      .from('basket_invite_tokens')
      .select('id, basket_id, token, expires_at, used_at, created_at')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      logger.error({ event: 'deeplink.join.lookup_failed', err: error });
      return jsonError({ error: 'lookup_failed' }, 500);
    }

    if (!data) {
      return jsonError({ error: 'token_not_found' }, 404);
    }

    if (data.expires_at) {
      const expiry = new Date(data.expires_at);
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        return jsonError({ error: 'token_expired' }, 410);
      }
    }

    return jsonOk({
      basketId: data.basket_id,
      token: data.token,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      usedAt: data.used_at,
    });
  });
}
