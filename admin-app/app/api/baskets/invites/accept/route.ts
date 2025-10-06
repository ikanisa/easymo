import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

function normalizeInviteToken(raw: string): string {
  const match = raw.trim().toUpperCase().match(/(?:JB[:\-])?([A-Z0-9]{4,})/);
  return match ? match[1] : '';
}

function formatShareCode(token: string): string {
  return token.startsWith('JB:') ? token : `JB:${token}`;
}

const acceptSchema = z.object({
  token: z.string().min(1),
  userId: z.string().uuid(),
});

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to accept invite.',
      },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof acceptSchema>;
  try {
    payload = acceptSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const cleanedToken = normalizeInviteToken(payload.token);
  if (!cleanedToken) {
    return NextResponse.json(
      {
        error: 'invalid_token',
        message: 'Provide a valid invite token.',
      },
      { status: 400 },
    );
  }

  const { data: invite, error: inviteError } = await adminClient
    .from('basket_invites')
    .select('id, ikimina_id, status, expires_at, issuer_member_id')
    .eq('token', cleanedToken)
    .eq('status', 'active')
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json(
      {
        error: 'invalid_token',
        message: 'Invite not found or already used.',
      },
      { status: 404 },
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    await adminClient
      .from('basket_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return NextResponse.json(
      {
        error: 'invite_expired',
        message: 'Invite has expired.',
      },
      { status: 410 },
    );
  }

  const { data: existingMembership, error: membershipLookupError } = await adminClient
    .from('ibimina_members')
    .select('id, ikimina_id, status')
    .eq('user_id', payload.userId)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipLookupError) {
    return NextResponse.json(
      {
        error: 'membership_lookup_failed',
        message: 'Unable to determine existing memberships.',
      },
      { status: 500 },
    );
  }

  if (existingMembership && existingMembership.ikimina_id !== invite.ikimina_id) {
    return NextResponse.json(
      {
        error: 'already_member',
        message: 'User already has an active Ikimina membership.',
      },
      { status: 409 },
    );
  }

  const upsertResult = await adminClient
    .from('ibimina_members')
    .upsert({
      ikimina_id: invite.ikimina_id,
      user_id: payload.userId,
      status: 'active',
    }, { onConflict: 'ikimina_id,user_id' })
    .select('id, ikimina_id, status')
    .single();

  if (upsertResult.error || !upsertResult.data) {
    const err = upsertResult.error;
    if (err?.message?.includes('idx_ibimina_members_active_user')) {
      return NextResponse.json(
        {
          error: 'already_member',
          message: 'User already has an active Ikimina membership.',
        },
        { status: 409 },
      );
    }
    logStructured({
      event: 'ibimina_member_upsert_failed',
      target: 'ibimina_members',
      status: 'error',
      message: err?.message ?? 'Unknown error',
    });
    return NextResponse.json(
      {
        error: 'membership_upsert_failed',
        message: 'Unable to activate membership.',
      },
      { status: 500 },
    );
  }

  await adminClient
    .from('basket_invites')
    .update({ status: 'used' })
    .eq('id', invite.id);

  await recordAudit({
    actorId: payload.userId,
    action: 'basket_invite_accept',
    targetTable: 'ibimina_members',
    targetId: upsertResult.data.id,
    diff: {
      invite_id: invite.id,
      ikimina_id: invite.ikimina_id,
      status: 'active',
    },
  });

  return NextResponse.json({
    membershipId: upsertResult.data.id,
    ikiminaId: invite.ikimina_id,
    status: upsertResult.data.status,
    shareCode: formatShareCode(cleanedToken),
  }, { status: 200 });
}
