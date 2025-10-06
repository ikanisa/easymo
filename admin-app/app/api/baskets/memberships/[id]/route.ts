import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const updateSchema = z.object({
  status: z.enum(['pending', 'active', 'removed']),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to update membership.',
      },
      { status: 503 },
    );
  }

  const memberId = params.id;
  if (!memberId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'Membership id is required.' },
      { status: 400 },
    );
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const actorId = headers().get('x-actor-id');

  const { data, error } = await adminClient
    .from('ibimina_members')
    .update({ status: payload.status })
    .eq('id', memberId)
    .select('id, ikimina_id, user_id, status')
    .single();

  if (error || !data) {
    logStructured({
      event: 'ibimina_member_update_failed',
      target: 'ibimina_members',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { memberId },
    });
    return NextResponse.json(
      {
        error: 'ibimina_member_update_failed',
        message: 'Unable to update membership.',
      },
      { status: error?.code === 'PGRST116' ? 404 : 500 },
    );
  }

  await recordAudit({
    actorId,
    action: 'ibimina_member_update',
    targetTable: 'ibimina_members',
    targetId: memberId,
    diff: { status: payload.status },
  });

  return NextResponse.json({ success: true });
}

