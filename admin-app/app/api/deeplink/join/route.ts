import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  t: z.string().min(1),
});

export const dynamic = 'force-dynamic';

export const GET = createHandler('deeplink.join', async (request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to resolve deeplink.',
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_token',
        message: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const token = parsed.data.t;

  const { data: tokenRow, error } = await adminClient
    .from('basket_invite_tokens')
    .select('id, token, basket_id, expires_at, used_at, created_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    logStructured({
      event: 'deeplink_token_lookup_failed',
      status: 'error',
      message: error.message,
      details: { token },
    });
    return NextResponse.json(
      {
        error: 'deeplink_lookup_failed',
        message: 'Unable to resolve token.',
      },
      { status: 500 },
    );
  }

  if (!tokenRow) {
    return NextResponse.json(
      { error: 'token_not_found', message: 'Invite token not found.' },
      { status: 404 },
    );
  }

  const now = Date.now();
  const expiresAtMs = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : null;
  if ((expiresAtMs && expiresAtMs < now) || tokenRow.used_at) {
    return NextResponse.json(
      {
        error: 'token_expired',
        message: 'Invite token has expired or already been used.',
      },
      { status: 410 },
    );
  }

  const { data: basket, error: basketError } = await adminClient
    .from('baskets')
    .select('id, name, creator_id, created_at, metadata')
    .eq('id', tokenRow.basket_id)
    .maybeSingle();

  if (basketError) {
    logStructured({
      event: 'deeplink_basket_lookup_failed',
      status: 'error',
      message: basketError.message,
      details: { basket_id: tokenRow.basket_id },
    });
    return NextResponse.json(
      {
        error: 'basket_lookup_failed',
        message: 'Unable to load basket details.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      basket: basket ?? { id: tokenRow.basket_id },
      token: tokenRow.token,
      expiresAt: tokenRow.expires_at,
      issuedAt: tokenRow.created_at,
    },
    { status: 200 },
  );
});

export const runtime = "nodejs";
