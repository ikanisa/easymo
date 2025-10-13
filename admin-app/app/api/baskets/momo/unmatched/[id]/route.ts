import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const updateSchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  reason: z.string().optional(),
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
        message: 'Supabase credentials missing. Unable to update unmatched SMS.',
      },
      { status: 503 },
    );
  }

  const unmatchedId = params.id;
  if (!unmatchedId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'Unmatched id is required.' },
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

  if (!Object.keys(payload).length) {
    return NextResponse.json(
      { error: 'empty_update', message: 'Provide at least one field to update.' },
      { status: 400 },
    );
  }

  const actorId = headers().get('x-actor-id');

  const { data, error } = await adminClient
    .from('momo_unmatched')
    .update({
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
    })
    .eq('id', unmatchedId)
    .select('id, status, reason')
    .single();

  if (error || !data) {
    logStructured({
      event: 'momo_unmatched_update_failed',
      target: 'momo_unmatched',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { unmatchedId },
    });
    return NextResponse.json(
      {
        error: 'momo_unmatched_update_failed',
        message: 'Unable to update unmatched SMS.',
      },
      { status: error?.code === 'PGRST116' ? 404 : 500 },
    );
  }

  await recordAudit({
    actorId,
    action: 'momo_unmatched_update',
    targetTable: 'momo_unmatched',
    targetId: unmatchedId,
    diff: {
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
    },
  });

  return NextResponse.json({ success: true });
}

