import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

const RESOLVER_BASE_OVERRIDE = process.env.BASKET_DEEPLINK_BASE_URL
  ?? process.env.NEXT_PUBLIC_BASKET_DEEPLINK_BASE_URL
  ?? null;

function generateInviteToken(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

function formatShareCode(token: string): string {
  return token.startsWith('JB:') ? token : `JB:${token}`;
}

function buildResolverBase(): string | null {
  if (RESOLVER_BASE_OVERRIDE) {
    return RESOLVER_BASE_OVERRIDE.replace(/\/$/, '');
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/deeplink-resolver`;
}

function buildWaShareUrl(token: string): string | null {
  const waNumber = process.env.WA_BOT_NUMBER_E164 ?? process.env.NEXT_PUBLIC_WA_BOT_NUMBER_E164 ?? '';
  const digits = waNumber.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(formatShareCode(token))}`;
}

const createSchema = z.object({
  ikiminaId: z.string().uuid(),
  issuerMemberId: z.string().uuid(),
  ttlMinutes: z.coerce.number().int().min(5).max(7_200).optional(),
});

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase credentials missing. Unable to create invite.',
    }, 503);
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  try {
    requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
  }

  const token = generateInviteToken();
  const ttlMinutes = payload.ttlMinutes ?? 60 * 24; // default 24h
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const { data, error } = await adminClient
    .from('basket_invites')
    .insert({
      ikimina_id: payload.ikiminaId,
      issuer_member_id: payload.issuerMemberId,
      token,
      expires_at: expiresAt,
      status: 'active',
    })
    .select('id, token, expires_at, status')
    .single();

  if (error || !data) {
    logStructured({
      event: 'basket_invite_create_failed',
      target: 'basket_invites',
      status: 'error',
      message: error?.message ?? 'Unknown error',
    });
    return jsonError({ error: 'basket_invite_create_failed', message: 'Unable to create invite.' }, 500);
  }

  const shareCode = formatShareCode(data.token);
  const resolverBase = buildResolverBase();
  const deepLinkUrl = resolverBase
    ? `${resolverBase}?token=${encodeURIComponent(data.token)}`
    : null;
  const waShareUrl = buildWaShareUrl(data.token);

  logStructured({
    event: 'basket_invite_created',
    target: 'basket_invites',
    status: 'ok',
    invite_id: data.id,
    resolver_available: Boolean(deepLinkUrl),
  });

  return jsonOk({
    id: data.id,
    token: data.token,
    shareCode,
    deepLinkUrl,
    waShareUrl,
    expiresAt: data.expires_at,
    status: data.status,
  }, 201);
}
