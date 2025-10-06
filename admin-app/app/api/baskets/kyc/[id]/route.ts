import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const updateSchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected']),
  notes: z.string().optional(),
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
        message: 'Supabase credentials missing. Unable to update KYC document.',
      },
      { status: 503 },
    );
  }

  const docId = params.id;
  if (!docId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'KYC document id is required.' },
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
    .from('kyc_documents')
    .update({
      status: payload.status,
      reviewed_at: new Date().toISOString(),
      parsed_json: payload.notes ? { ...payload, notes: payload.notes } : undefined,
    })
    .eq('id', docId)
    .select('id, status, user_id')
    .single();

  if (error || !data) {
    logStructured({
      event: 'kyc_update_failed',
      target: 'kyc_documents',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { docId },
    });
    return NextResponse.json(
      {
        error: 'kyc_update_failed',
        message: 'Unable to update KYC document.',
      },
      { status: error?.code === 'PGRST116' ? 404 : 500 },
    );
  }

  await recordAudit({
    actorId,
    action: 'kyc_update',
    targetTable: 'kyc_documents',
    targetId: docId,
    diff: { status: payload.status, notes: payload.notes ?? null },
  });

  return NextResponse.json({ success: true });
}

