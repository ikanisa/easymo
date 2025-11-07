export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { callBridge } from '@/lib/server/edge-bridges';
import { createHandler } from '@/app/api/withObservability';

const requestSchema = z.object({
  quoteId: z.string().uuid(),
  comment: z.string().min(1)
});

export const POST = createHandler('admin_api.insurance.request_changes', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to request changes.' }, 503);
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
  }

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
    return jsonError({ error: 'request_changes_failed', message: 'Unable to update insurance quote.' }, 500);
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

  return (bridgeResult.ok
    ? jsonOk({ status: 'needs_changes', integration })
    : jsonError({ status: 'needs_changes', integration } as any, bridgeResult.status ?? 503));
});
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

export const runtime = "nodejs";
