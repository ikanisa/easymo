import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getServiceSupabaseClient } from '../../_lib/supabase-admin';
import { jsonError, jsonOk } from '../../_lib/http';
import { getFeatureFlag } from '../../_lib/feature-flags';
import { sendWhatsAppMessage } from '../../wa/send/service';

const schema = z.object({
  profileId: z.string().uuid(),
  creatorUserId: z.string().uuid(),
  creatorMsisdn: z.string().min(5),
  name: z.string().min(2),
  isPublic: z.boolean().default(false),
  goalMinor: z.number().int().nonnegative().nullable().optional(),
});

const DEEPLINK_BASE = process.env.BASKET_DEEPLINK_BASE_URL ?? 'https://easymo.link/join';

function generateToken(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase();
}

function buildDeepLink(token: string): string {
  const base = DEEPLINK_BASE.replace(/\/$/, '');
  return `${base}?t=${encodeURIComponent(token)}`;
}

export async function POST(request: Request) {
  const supabase = getServiceSupabaseClient();

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (error) {
    console.error('basket.create.invalid_payload', error);
    return jsonError({ error: 'invalid_payload' }, 400);
  }

  const { data, error } = await supabase.rpc('basket_create', {
    _profile_id: payload.profileId,
    _whatsapp: payload.creatorMsisdn,
    _name: payload.name,
    _is_public: payload.isPublic,
    _goal_minor: payload.goalMinor ?? null,
  });

  if (error) {
    console.error('basket.create.rpc_failed', error);
    return jsonError({ error: 'basket_create_failed', detail: error.message }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const basketId = row?.basket_id ?? row?.id ?? null;

  if (!basketId) {
    return jsonError({ error: 'basket_create_missing_id' }, 500);
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await supabase
    .from('basket_invite_tokens')
    .insert({
      basket_id: basketId,
      token,
      expires_at: expiresAt,
      created_by: payload.creatorUserId,
    });

  if (tokenError) {
    console.error('basket.create.token_failed', tokenError);
    return jsonError({ error: 'basket_token_failed' }, 500);
  }

  const deepLink = buildDeepLink(token);

  console.info('basket_create_success', {
    basket_id: basketId,
    created_by: payload.creatorUserId,
  });
  console.info('basket_invite_token_issued', {
    basket_id: basketId,
    token,
  });

  const confirmationFlag = await getFeatureFlag(
    supabase,
    'basket.confirmation.enabled',
    true,
  );
  const confirmationEnabled = Boolean(
    typeof confirmationFlag === 'boolean'
      ? confirmationFlag
      : (confirmationFlag as { enabled?: boolean })?.enabled ?? true,
  );

  if (confirmationEnabled) {
    const message = {
      to: payload.creatorMsisdn,
      type: 'interactive',
      header: { type: 'text', text: 'Basket created 🎉' },
      body: {
        text: `Your basket **${payload.name}** is live.\nShare this link to invite members:\n${deepLink}\n\nTap below to open it now.`,
      },
      action: {
        buttons: [
          { type: 'url', url: deepLink, title: 'View Basket' },
        ],
      },
    } as const;

    const sendResult = await sendWhatsAppMessage(message);
    console.info('wa_message_sent', {
      basket_id: basketId,
      ok: sendResult.ok,
      status: sendResult.status,
    });
  }

  return jsonOk({
    basketId,
    inviteToken: token,
    deeplink: deepLink,
    expiresAt,
  }, 201);
}
