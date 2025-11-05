import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk, jsonResponse } from '../../_lib/http';
import { enforceRateLimit } from '../../_lib/rate-limit';
import { withRouteInstrumentation } from '../../_lib/observability';
import {
  buildDeepLinkUrl,
  DeeplinkFlow,
  ensureFlowEnabled,
  getFlowConfig,
  recordDeeplinkEvent,
  stripNonce,
  verifySignedToken,
} from '../_lib/deeplinks';

const querySchema = z.object({
  t: z.string().min(10),
});

const RATE_LIMIT_KEY_PREFIX = 'deeplink:resolve';
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 60;

function extractClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const [first] = forwarded.split(',');
    if (first) {
      return first.trim();
    }
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

export async function GET(request: Request) {
  return withRouteInstrumentation('deeplink.resolve.GET', request, async ({ logger, traceId }) => {
    const supabase = getServiceSupabaseClient();
    const url = new URL(request.url);

    const ip = extractClientIp(request);
    const rateLimitResult = enforceRateLimit(
      `${RATE_LIMIT_KEY_PREFIX}:${ip}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS,
    );

    if (!rateLimitResult.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil(rateLimitResult.retryAfterMs / 1000));
      return jsonResponse(
        { error: 'rate_limited', retryAfterSeconds },
        {
          status: 429,
          headers: { 'retry-after': `${retryAfterSeconds}` },
        },
      );
    }

    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return jsonError({ error: 'invalid_token', details: parsed.error.flatten() }, 400);
    }

    const token = parsed.data.t.trim();

    let decoded:
      | {
          payload: { flow: string; nonce: string; exp: string; msisdn?: string | null };
        }
      | null = null;
    try {
      decoded = verifySignedToken(token);
    } catch (error) {
      logger.error({ event: 'deeplink.resolve.decode_failed', err: error });
      return jsonError({ error: 'invalid_token_signature' }, 400);
    }

    const { data, error } = await supabase
      .from('deeplink_tokens')
      .select('id, flow, payload, msisdn_e164, expires_at, used_at, multi_use')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      logger.error({ event: 'deeplink.resolve.lookup_failed', err: error });
      return jsonError({ error: 'token_lookup_failed' }, 500);
    }

    if (!data) {
      return jsonError({ error: 'token_not_found' }, 404);
    }

    if (!decoded || decoded.payload.flow !== data.flow) {
      logger.error({ event: 'deeplink.resolve.flow_mismatch',
        tokenId: data.id,
        expected: data.flow,
        actual: decoded?.payload.flow,
      });
      return jsonError({ error: 'token_flow_mismatch' }, 409);
    }

    const flow = data.flow as DeeplinkFlow;

    const tokenExpiry = decoded.payload.exp ? new Date(decoded.payload.exp) : null;
    if (!tokenExpiry || Number.isNaN(tokenExpiry.getTime())) {
      return jsonError({ error: 'token_expiry_invalid' }, 500);
    }

    const storedNonce = (data.payload as Record<string, unknown> | null)?.nonce;
    if (typeof storedNonce === 'string' && storedNonce !== decoded.payload.nonce) {
      logger.error({ event: 'deeplink.resolve.nonce_mismatch',
        tokenId: data.id,
        expected: storedNonce,
        actual: decoded.payload.nonce,
      });
      return jsonError({ error: 'token_nonce_mismatch' }, 409);
    }

    const expiresAt = new Date(data.expires_at);
    if (Number.isNaN(expiresAt.getTime())) {
      return jsonError({ error: 'token_expiry_invalid' }, 500);
    }

    if (tokenExpiry.getTime() <= Date.now() || expiresAt.getTime() <= Date.now()) {
      await recordDeeplinkEvent(
        supabase,
        data.id,
        'expired',
        { flow, reason: 'expired_on_resolve', nonce: decoded.payload.nonce },
      );
      return jsonError({ error: 'token_expired' }, 410);
    }

    const flowEnabled = await ensureFlowEnabled(supabase, flow);
    if (!flowEnabled) {
      return jsonError({ error: 'flow_disabled' }, 403);
    }

    const viewUrl = buildDeepLinkUrl(flow, token);

    await recordDeeplinkEvent(
      supabase,
      data.id,
      'opened',
      { flow, via: 'resolver', nonce: decoded.payload.nonce },
      decoded.payload.msisdn ?? null,
    );

    const payloadWithoutNonce = stripNonce(data.payload as Record<string, unknown> | null);
    const config = getFlowConfig(flow);

    return jsonOk({
      ok: true,
      tokenId: data.id,
      flow,
      payload: payloadWithoutNonce,
      expiresAt: data.expires_at,
      msisdnBound: data.msisdn_e164 ?? null,
      nextStepHint: config?.nextStepHint,
      multiUse: Boolean(data.multi_use),
      viewUrl,
      rateLimit: {
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetAt: new Date(rateLimitResult.resetAt).toISOString(),
      },
    });
  });
}
