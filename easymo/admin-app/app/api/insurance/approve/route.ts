import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { callBridge } from '@/lib/server/edge-bridges';

const requestSchema = z.object({
  quoteId: z.string().uuid()
});

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to approve insurance.'
      },
      { status: 503 }
    );
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  const actorId = headers().get('x-actor-id');
  const timestamp = new Date().toISOString();

  const { data, error } = await adminClient
    .from('insurance_quotes')
    .update({ status: 'approved', approved_at: timestamp })
    .eq('id', payload.quoteId)
    .select('id, metadata')
    .maybeSingle();

  if (error || !data) {
    logStructured({
      event: 'insurance_approve_failed',
      target: 'insurance_quotes',
      status: 'error',
      message: error?.message ?? 'Quote not found',
      details: { quoteId: payload.quoteId }
    });
    return NextResponse.json(
      {
        error: 'approve_failed',
        message: 'Unable to approve insurance quote.'
      },
      { status: 500 }
    );
  }

  const bridgeResult = await callBridge('insuranceWorkflow', {
    quoteId: payload.quoteId,
    status: 'approved'
  });

  await recordAudit({
    actorId,
    action: 'insurance_approve',
    targetTable: 'insurance_quotes',
    targetId: payload.quoteId,
    diff: { status: 'approved' }
  });

  const integration = bridgeResult.ok
    ? { status: 'ok' as const, target: 'insurance_workflow' }
    : {
        status: 'degraded' as const,
        target: 'insurance_workflow',
        message: bridgeResult.message
      };

  return NextResponse.json(
    {
      status: 'approved',
      integration
    },
    { status: bridgeResult.ok ? 200 : bridgeResult.status ?? 503 }
  );
}
