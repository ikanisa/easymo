export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { logStructured } from '@/lib/server/logger';
import { isFeatureEnabled } from '@/lib/server/feature-flags';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { sendWhatsAppMessage } from '@/lib/server/whatsapp';

const createSchema = z
  .object({
    name: z.string().min(1),
    creatorId: z.string().uuid(),
    creatorMsisdn: z.string().min(5),
    description: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    tokenTtlMinutes: z.coerce.number().int().min(1).max(60 * 24 * 30).optional(),
  })
  .passthrough();

function pruneUndefined(input: Record<string, unknown>) {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      clone[key] = value;
    }
  }
  return clone;
}

function buildDeeplink(token: string): string {
  return `https://easymo.link/join?t=${encodeURIComponent(token)}`;
}

export const POST = createHandler('baskets.create', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to create basket.',
      },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const { name, creatorId, creatorMsisdn, tokenTtlMinutes, ...rest } = payload;
  const insertPayload = pruneUndefined({
    name,
    creator_id: creatorId,
    creator_msisdn: creatorMsisdn,
    ...rest,
  });

  const { data: basket, error: basketError } = await adminClient
    .from('baskets')
    .insert(insertPayload)
    .select('id, name, creator_id, created_at')
    .single();

  if (basketError || !basket) {
    logStructured({
      event: 'basket_create_failed',
      status: 'error',
      message: basketError?.message ?? 'Unknown error',
    });
    return NextResponse.json(
      {
        error: 'basket_create_failed',
        message: 'Unable to create basket.',
      },
      { status: 500 },
    );
  }

  const ttlInterval = tokenTtlMinutes ? `${tokenTtlMinutes} minutes` : undefined;
  const tokenResult = await adminClient.rpc('issue_basket_invite_token', {
    _basket_id: basket.id,
    _created_by: creatorId,
    _ttl: ttlInterval ?? null,
  });
  const tokenRow = tokenResult.data as {
    id: string;
    basket_id: string;
    token: string;
    expires_at: string;
  } | null;
  const tokenError = tokenResult.error;

  if (tokenError || !tokenRow) {
    logStructured({
      event: 'basket_invite_token_issue_failed',
      status: 'error',
      message: tokenError?.message ?? 'Unable to issue token',
      details: { basket_id: basket.id },
    });
    return NextResponse.json(
      {
        error: 'basket_token_failed',
        message: 'Basket created but invite token failed.',
        basketId: basket.id,
      },
      { status: 502 },
    );
  }

  logStructured({
    event: 'basket_invite_token_issued',
    status: 'ok',
    details: { basket_id: tokenRow.basket_id, token_id: tokenRow.id },
  });

  const deeplink = buildDeeplink(tokenRow.token);

  const waPayload = {
    to: creatorMsisdn,
    type: 'interactive',
    header: { type: 'text', text: 'Basket created 🎉' },
    body: {
      text: `Your basket **${name}** is live.\nShare this link to invite members:\n${deeplink}\n\nTap below to open it now.`,
    },
    action: {
      buttons: [
        {
          type: 'url',
          url: deeplink,
          title: 'View Basket',
        },
      ],
    },
  } satisfies Record<string, unknown>;

  if (isFeatureEnabled('basket.confirmation.enabled', true)) {
    try {
      await sendWhatsAppMessage(waPayload);
    } catch (error) {
      logStructured({
        event: 'basket_confirmation_whatsapp_failed',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown WhatsApp error',
        details: { basket_id: basket.id },
      });
    }
  }

  logStructured({
    event: 'basket_create_success',
    status: 'ok',
    details: { basket_id: basket.id },
  });

  recordMetric('basket.create.success', 1, { confirmation_sent: isFeatureEnabled('basket.confirmation.enabled', true) });

  return NextResponse.json(
    {
      basketId: basket.id,
      name: basket.name,
      deeplink,
      token: tokenRow.token,
      tokenExpiresAt: tokenRow.expires_at,
    },
    { status: 201 },
  );
});
