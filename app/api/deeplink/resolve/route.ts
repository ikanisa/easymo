import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import {
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

export async function GET(request: Request) {
  const supabase = getServiceSupabaseClient();
  const url = new URL(request.url);
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
    console.error('deeplink.resolve.decode_failed', error);
    return jsonError({ error: 'invalid_token_signature' }, 400);
  }

  const { data, error } = await supabase
    .from('deeplink_tokens')
    .select('id, flow, payload, msisdn_e164, expires_at, used_at, multi_use')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('deeplink.resolve.lookup_failed', error);
    return jsonError({ error: 'token_lookup_failed' }, 500);
  }

  if (!data) {
    return jsonError({ error: 'token_not_found' }, 404);
  }

  if (!decoded || decoded.payload.flow !== data.flow) {
    console.error('deeplink.resolve.flow_mismatch', {
      tokenId: data.id,
      expected: data.flow,
      actual: decoded?.payload.flow,
    });
    return jsonError({ error: 'token_flow_mismatch' }, 409);
  }

  const flow = data.flow as DeeplinkFlow;

  const storedNonce = (data.payload as Record<string, unknown> | null)?.nonce;
  if (typeof storedNonce === 'string' && storedNonce !== decoded.payload.nonce) {
    console.error('deeplink.resolve.nonce_mismatch', {
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
    await recordDeeplinkEvent(
      supabase,
      data.id,
      'expired',
      { flow, reason: 'expired_on_resolve' },
    );
    return jsonError({ error: 'token_expired' }, 410);
  }

  const flowEnabled = await ensureFlowEnabled(supabase, flow);
  if (!flowEnabled) {
    return jsonError({ error: 'flow_disabled' }, 403);
  }

  await recordDeeplinkEvent(
    supabase,
    data.id,
    'opened',
    { flow, via: 'resolver' },
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
  });
}
