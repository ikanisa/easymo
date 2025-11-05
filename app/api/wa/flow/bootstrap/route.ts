import { z } from 'zod';
import { getServiceSupabaseClient } from '../../../_lib/supabase-admin';
import { jsonError, jsonOk, jsonResponse } from '../../../_lib/http';
import { enforceRateLimit } from '../../../_lib/rate-limit';
import { withRouteInstrumentation } from '../../../_lib/observability';
import {
  buildBootstrap,
  buildDeepLinkUrl,
  DeeplinkFlow,
  ensureFlowEnabled,
  recordDeeplinkEvent,
  stripNonce,
  verifySignedToken,
} from '../../../deeplink/_lib/deeplinks';

const payloadSchema = z.object({
  token: z.string().min(10),
  user_msisdn: z.string().min(5),
});

const RATE_LIMIT_KEY_PREFIX = 'deeplink:bootstrap';
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

function normalizeMsisdn(msisdn: string) {
  return msisdn.replace(/\s+/g, '');
}

export async function POST(request: Request) {
  return withRouteInstrumentation('wa.flow.bootstrap.POST', request, async ({ logger, traceId }) => {
    const supabase = getServiceSupabaseClient();

    const ip = extractClientIp(request);
    const ipRateLimit = enforceRateLimit(
      `${RATE_LIMIT_KEY_PREFIX}:ip:${ip}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS,
    );

    if (!ipRateLimit.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil(ipRateLimit.retryAfterMs / 1000));
      return jsonResponse(
        { error: 'rate_limited', scope: 'ip', retryAfterSeconds },
        {
          status: 429,
          headers: { 'retry-after': `${retryAfterSeconds}` },
        },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch (error) {
      logger.error({ event: 'deeplink.bootstrap.invalid_json', err: error });
      return jsonError({ error: 'invalid_json' }, 400);
    }

    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
    }

    const token = parsed.data.token.trim();
    const userMsisdn = normalizeMsisdn(parsed.data.user_msisdn);

    const userRateLimit = enforceRateLimit(
      `${RATE_LIMIT_KEY_PREFIX}:user:${userMsisdn}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS,
    );

    if (!userRateLimit.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil(userRateLimit.retryAfterMs / 1000));
      return jsonResponse(
        { error: 'rate_limited', scope: 'user', retryAfterSeconds },
        {
          status: 429,
          headers: { 'retry-after': `${retryAfterSeconds}` },
        },
      );
    }

    let decoded:
      | {
          payload: { flow: DeeplinkFlow; nonce: string; exp: string; msisdn?: string | null };
        }
      | null = null;
    try {
      decoded = verifySignedToken(token);
    } catch (error) {
      logger.error({ event: 'deeplink.bootstrap.decode_failed', err: error });
      return jsonError({ error: 'invalid_token_signature' }, 400);
    }

    const { data, error } = await supabase
      .from('deeplink_tokens')
      .select('id, flow, payload, msisdn_e164, expires_at, used_at, multi_use')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      logger.error({ event: 'deeplink.bootstrap.lookup_failed', err: error });
      return jsonError({ error: 'token_lookup_failed' }, 500);
    }

    if (!data) {
      return jsonError({ error: 'token_not_found' }, 404);
    }

    const flow = data.flow as DeeplinkFlow;
    if (!decoded || decoded.payload.flow !== flow) {
      logger.error({ event: 'deeplink.bootstrap.flow_mismatch',
        tokenId: data.id,
        expected: flow,
        actual: decoded?.payload.flow,
      });
      return jsonError({ error: 'token_flow_mismatch' }, 409);
    }

    const tokenExpiry = decoded.payload.exp ? new Date(decoded.payload.exp) : null;
    if (!tokenExpiry || Number.isNaN(tokenExpiry.getTime())) {
      return jsonError({ error: 'token_expiry_invalid' }, 500);
    }

    const storedNonce = (data.payload as Record<string, unknown> | null)?.nonce;
    if (typeof storedNonce === 'string' && storedNonce !== decoded.payload.nonce) {
      logger.error({ event: 'deeplink.bootstrap.nonce_mismatch',
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
      await recordDeeplinkEvent(supabase, data.id, 'expired', {
        flow,
        reason: 'expired_on_bootstrap',
        nonce: decoded.payload.nonce,
      });
      return jsonError({ error: 'token_expired' }, 410);
    }

    const flowEnabled = await ensureFlowEnabled(supabase, flow);
    if (!flowEnabled) {
      return jsonError({ error: 'flow_disabled' }, 403);
    }

    if (data.msisdn_e164 && normalizeMsisdn(data.msisdn_e164) !== userMsisdn) {
      await recordDeeplinkEvent(
        supabase,
        data.id,
        'denied',
        { flow, reason: 'msisdn_mismatch', expected: data.msisdn_e164, actual: userMsisdn, nonce: decoded.payload.nonce },
        userMsisdn,
      );
      return jsonError({ error: 'token_denied', reason: 'msisdn_mismatch' }, 403);
    }

    const payloadWithoutNonce = stripNonce(data.payload as Record<string, unknown> | null);
    const linkUrl = buildDeepLinkUrl(flow, token);
    const bootstrap = buildBootstrap(flow, payloadWithoutNonce, linkUrl);

    const chatState = {
      deeplink: {
        tokenId: data.id,
        flow,
        nonce: decoded.payload.nonce,
        payload: payloadWithoutNonce,
        multiUse: Boolean(data.multi_use),
        issuedTo: data.msisdn_e164 ?? null,
        resolvedAt: new Date().toISOString(),
      },
      flow: bootstrap.flowState,
    } as const;

    const { error: sessionError } = await supabase
      .from('chat_sessions')
      .upsert(
        {
          user_id: userMsisdn,
          state: chatState,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (sessionError) {
      logger.error({ event: 'deeplink.bootstrap.session_upsert_failed', err: sessionError });
      return jsonError({ error: 'session_upsert_failed', detail: sessionError.message }, 500);
    }

    await recordDeeplinkEvent(
      supabase,
      data.id,
      'opened',
      { flow, via: 'bootstrap', nonce: decoded.payload.nonce },
      userMsisdn,
    );

    let outboundMessage: Record<string, unknown> = {
      to: userMsisdn,
      type: 'text',
      text: {
        body: bootstrap.firstPrompt.text,
      },
    };

    if (bootstrap.firstPrompt.type === 'interactive') {
      const buttons = (bootstrap.firstPrompt.buttons ?? []).map((button, index) => {
        if (button.type === 'url') {
          return {
            type: 'url',
            url: button.url ?? linkUrl,
            title: button.title,
          };
        }
        return {
          type: 'reply',
          reply: {
            id: button.payload ?? `deeplink_option_${index + 1}`,
            title: button.title,
          },
        };
      });

      outboundMessage = {
        to: userMsisdn,
        type: 'interactive',
        header: { type: 'text', text: 'One-tap access' },
        body: { text: bootstrap.firstPrompt.text },
        action: { buttons },
      };
    }

    return jsonOk({
      ok: true,
      tokenId: data.id,
      flow,
      flowState: bootstrap.flowState,
      firstPrompt: bootstrap.firstPrompt,
      outboundMessage,
      msisdnBound: data.msisdn_e164 ?? null,
      multiUse: Boolean(data.multi_use),
      expiresAt: data.expires_at,
      rateLimit: {
        ip: {
          limit: ipRateLimit.limit,
          remaining: ipRateLimit.remaining,
          resetAt: new Date(ipRateLimit.resetAt).toISOString(),
        },
        user: {
          limit: userRateLimit.limit,
          remaining: userRateLimit.remaining,
          resetAt: new Date(userRateLimit.resetAt).toISOString(),
        },
      },
    });
  });
}
