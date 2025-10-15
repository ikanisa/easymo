import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import {
  buildDeepLinkUrl,
  createNonce,
  createSignedToken,
  DEFAULT_TTL_MINUTES,
  DeeplinkFlow,
  ensureFlowEnabled,
  recordDeeplinkEvent,
  computeExpiry,
  MAX_TTL_MINUTES,
} from '../_lib/deeplinks';

const baseSchema = z.object({
  flow: z.enum(['insurance_attach', 'basket_open', 'generate_qr']),
  payload: z.record(z.unknown()),
  msisdn_e164: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{5,15}$/)
    .optional(),
  ttl_minutes: z
    .number()
    .int()
    .min(5)
    .max(MAX_TTL_MINUTES)
    .optional(),
  multi_use: z.boolean().optional(),
  created_by: z.string().uuid().optional(),
});

const insurancePayloadSchema = z.object({
  request_id: z.string().min(3),
  policy_id: z.string().min(3).optional(),
  basket_id: z.string().min(3).optional(),
});

const basketPayloadSchema = z.object({
  basket_id: z.string().min(3),
  inviter_id: z.string().uuid().optional(),
  basket_name: z.string().min(2).optional(),
});

const qrPayloadSchema = z.object({
  amount: z.number().int().positive().optional(),
  note: z.string().min(1).max(120).optional(),
  currency: z.string().min(2).max(10).optional(),
  merchant_code: z.string().min(2).max(64).optional(),
});

const FLOW_PAYLOAD_SCHEMAS: Record<DeeplinkFlow, z.ZodTypeAny> = {
  insurance_attach: insurancePayloadSchema,
  basket_open: basketPayloadSchema,
  generate_qr: qrPayloadSchema,
};

export async function POST(request: Request) {
  const supabase = getServiceSupabaseClient();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    console.error('deeplink.issue.invalid_json', error);
    return jsonError({ error: 'invalid_json' }, 400);
  }

  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const { flow, payload, msisdn_e164: msisdnRaw, ttl_minutes, multi_use = false, created_by } = parsed.data;
  const payloadSchema = FLOW_PAYLOAD_SCHEMAS[flow];
  const payloadParsed = payloadSchema.safeParse(payload);
  if (!payloadParsed.success) {
    return jsonError({ error: 'invalid_flow_payload', details: payloadParsed.error.flatten() }, 400);
  }

  const flowEnabled = await ensureFlowEnabled(supabase, flow);
  if (!flowEnabled) {
    return jsonError({ error: 'flow_disabled' }, 403);
  }

  const ttl = ttl_minutes ?? DEFAULT_TTL_MINUTES;
  const expiresAt = computeExpiry(ttl);
  const nonce = createNonce();
  const msisdn = msisdnRaw ? msisdnRaw.replace(/\s+/g, '') : null;

  let token: string;
  try {
    token = createSignedToken({
      flow,
      nonce,
      exp: expiresAt.toISOString(),
      msisdn,
    });
  } catch (error) {
    console.error('deeplink.issue.token_sign_failed', error);
    return jsonError({ error: 'token_sign_failed' }, 500);
  }

  const storedPayload = { ...payloadParsed.data, nonce };
  const { data, error } = await supabase
    .from('deeplink_tokens')
    .insert({
      flow,
      token,
      payload: storedPayload,
      msisdn_e164: msisdn,
      expires_at: expiresAt.toISOString(),
      multi_use,
      created_by: created_by ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('deeplink.issue.insert_failed', error);
    return jsonError({ error: 'token_persist_failed', detail: error.message }, 500);
  }

  if (!data?.id) {
    return jsonError({ error: 'token_missing_id' }, 500);
  }

  await recordDeeplinkEvent(
    supabase,
    data.id,
    'issued',
    {
      nonce,
      flow,
      expires_at: expiresAt.toISOString(),
      multi_use,
    },
    msisdn,
  );

  const url = buildDeepLinkUrl(flow, token);

  return jsonOk({
    ok: true,
    flow,
    token,
    url,
    expiresAt: expiresAt.toISOString(),
    payload: payloadParsed.data,
    msisdnBound: msisdn,
    multiUse: multi_use,
    nonce,
    ttlMinutes: ttl,
  }, 201);
}
