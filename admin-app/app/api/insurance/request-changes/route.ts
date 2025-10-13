import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { callBridge } from '@/lib/server/edge-bridges';

const requestSchema = z.object({
  quoteId: z.string().uuid(),
  comment: z.string().min(1)
});

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to request changes.'
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

  const { error } = await adminClient
    .from('insurance_quotes')
    .update({ status: 'needs_changes', reviewer_comment: payload.comment })
    .eq('id', payload.quoteId);

  if (error) {
    logStructured({
      event: 'insurance_request_changes_failed',
      target: 'insurance_quotes',
      status: 'error',
      message: error.message,
      details: { quoteId: payload.quoteId }
    });
    return NextResponse.json(
      {
        error: 'request_changes_failed',
        message: 'Unable to update insurance quote.'
      },
      { status: 500 }
    );
  }

  const bridgeResult = await callBridge('insuranceWorkflow', {
    quoteId: payload.quoteId,
    status: 'needs_changes',
    comment: payload.comment
  });

  await recordAudit({
    actorId,
    action: 'insurance_request_changes',
    targetTable: 'insurance_quotes',
    targetId: payload.quoteId,
    diff: { status: 'needs_changes', comment: payload.comment }
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
      status: 'needs_changes',
      integration
    },
    { status: bridgeResult.ok ? 200 : bridgeResult.status ?? 503 }
  );
}
