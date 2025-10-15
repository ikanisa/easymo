import { z } from 'zod';
import { getServiceSupabaseClient } from '../../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../../_lib/http';
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

function normalizeMsisdn(msisdn: string) {
  return msisdn.replace(/\s+/g, '');
}

export async function POST(request: Request) {
  const supabase = getServiceSupabaseClient();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    console.error('deeplink.bootstrap.invalid_json', error);
    return jsonError({ error: 'invalid_json' }, 400);
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const token = parsed.data.token.trim();
  const userMsisdn = normalizeMsisdn(parsed.data.user_msisdn);

  let decoded:
    | {
        payload: { flow: DeeplinkFlow; nonce: string; exp: string; msisdn?: string | null };
      }
    | null = null;
  try {
    decoded = verifySignedToken(token);
  } catch (error) {
    console.error('deeplink.bootstrap.decode_failed', error);
    return jsonError({ error: 'invalid_token_signature' }, 400);
  }

  const { data, error } = await supabase
    .from('deeplink_tokens')
    .select('id, flow, payload, msisdn_e164, expires_at, used_at, multi_use')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('deeplink.bootstrap.lookup_failed', error);
    return jsonError({ error: 'token_lookup_failed' }, 500);
  }

  if (!data) {
    return jsonError({ error: 'token_not_found' }, 404);
  }

  const flow = data.flow as DeeplinkFlow;
  if (!decoded || decoded.payload.flow !== flow) {
    console.error('deeplink.bootstrap.flow_mismatch', {
      tokenId: data.id,
      expected: flow,
      actual: decoded?.payload.flow,
    });
    return jsonError({ error: 'token_flow_mismatch' }, 409);
  }

  const storedNonce = (data.payload as Record<string, unknown> | null)?.nonce;
  if (typeof storedNonce === 'string' && storedNonce !== decoded.payload.nonce) {
    console.error('deeplink.bootstrap.nonce_mismatch', {
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
  if (expiresAt.getTime() <= Date.now()) {
    await recordDeeplinkEvent(supabase, data.id, 'expired', {
      flow,
      reason: 'expired_on_bootstrap',
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
      { flow, reason: 'msisdn_mismatch', expected: data.msisdn_e164, actual: userMsisdn },
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
    console.error('deeplink.bootstrap.session_upsert_failed', sessionError);
    return jsonError({ error: 'session_upsert_failed', detail: sessionError.message }, 500);
  }

  await recordDeeplinkEvent(
    supabase,
    data.id,
    'opened',
    { flow, via: 'bootstrap' },
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
  });
}
