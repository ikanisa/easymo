import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { bridgeDegraded, bridgeHealthy, callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const requestSchema = z.object({
  campaignId: z.string().uuid()
});

export type CampaignAction = 'start' | 'pause' | 'stop';

async function updateCampaignState(
  campaignId: string,
  action: CampaignAction
): Promise<NextResponse | { id: string; status: string | null }> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to update campaign state.'
      },
      { status: 503 }
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};
  if (action === 'start') {
    updates.status = 'running';
    updates.started_at = now;
  } else if (action === 'pause') {
    updates.status = 'paused';
  } else if (action === 'stop') {
    updates.status = 'done';
    updates.finished_at = now;
  }

  const { data, error } = await adminClient
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)
    .select('id, status')
    .maybeSingle();

  if (error || !data) {
    logStructured({
      event: 'campaign_state_update_failed',
      target: 'campaigns',
      status: 'error',
      message: error?.message ?? 'Campaign not found',
      details: { campaignId }
    });
    return NextResponse.json(
      {
        error: 'campaign_update_failed',
        message: 'Failed to update campaign state.'
      },
      { status: 500 }
    );
  }

  return data;
}

async function invokeDispatcher(campaignId: string, action: CampaignAction) {
  return callBridge<{ state?: string; message?: string }>('campaignDispatch', {
    campaignId,
    action
  });
}

export async function handleAction(request: Request, action: CampaignAction) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to update campaign state.'
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

  const updateResult = await updateCampaignState(payload.campaignId, action);
  if (updateResult instanceof NextResponse) {
    return updateResult; // error response
  }

  const stateByAction: Record<CampaignAction, 'running' | 'paused' | 'done'> = {
    start: 'running',
    pause: 'paused',
    stop: 'done'
  };

  const successMessages: Record<CampaignAction, string> = {
    start: 'Campaign start dispatched.',
    pause: 'Campaign pause dispatched.',
    stop: 'Campaign stop dispatched.'
  };

  const dispatcherResult = await invokeDispatcher(payload.campaignId, action);

  let responseState = updateResult.status ?? stateByAction[action];
  let responseMessage = successMessages[action];
  let statusCode = 200;
  let integration = bridgeHealthy('campaignDispatch');

  if (!dispatcherResult.ok) {
    statusCode = dispatcherResult.reason === 'missing_endpoint'
      ? 200
      : dispatcherResult.status ?? 503;
    integration = bridgeDegraded('campaignDispatch', dispatcherResult);
    responseMessage = dispatcherResult.message ?? successMessages[action];
  } else {
    const dispatcherState = dispatcherResult.data?.state;
    if (dispatcherState) {
      responseState = dispatcherState;
    }
    if (dispatcherResult.data?.message) {
      responseMessage = dispatcherResult.data.message;
    }
  }

  const auditDiff: Record<string, unknown> = {
    action,
    state: responseState,
    integrationStatus: integration.status
  };

  if ('reason' in integration) {
    auditDiff.integrationReason = integration.reason;
  }

  await recordAudit({
    actorId,
    action: `campaign_${action}`,
    targetTable: 'campaigns',
    targetId: payload.campaignId,
    diff: auditDiff
  });

  logStructured({
    event: 'campaign_state_change',
    target: 'campaigns',
    status: integration.status === 'ok' ? 'ok' : 'degraded',
    details: {
      campaignId: payload.campaignId,
      action,
      state: responseState,
      integration
    }
  });

  return NextResponse.json(
    {
      id: payload.campaignId,
      state: responseState,
      message: responseMessage,
      integration
    },
    { status: statusCode }
  );
}
