import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { callBridge } from '@/lib/server/edge-bridges';
import { createHandler } from '@/app/api/withObservability';

const requestSchema = z.object({
  quoteId: z.string().uuid()
});

export const POST = createHandler('admin_api.insurance.approve', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to approve insurance.' }, 503);
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
    return jsonError({ error: 'approve_failed', message: 'Unable to approve insurance quote.' }, 500);
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

  return (bridgeResult.ok
    ? jsonOk({ status: 'approved', integration })
    : jsonError({ status: 'approved', integration } as any, bridgeResult.status ?? 503));
});
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
