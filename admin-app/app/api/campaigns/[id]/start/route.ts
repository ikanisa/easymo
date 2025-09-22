import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/lib/server/audit';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { bridgeDegraded, bridgeHealthy, callBridge } from '@/lib/server/edge-bridges';

const bridgeResponseSchema = z
  .object({
    state: z.enum(['running', 'paused', 'done']).optional(),
    message: z.string().optional()
  })
  .passthrough();

const paramsSchema = z.object({
  id: z.string().min(1)
});

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: { id: string } }) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { error } = await adminClient
        .from('campaigns')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Failed to start campaign in Supabase', error);
      }
    }

    const bridgeResult = await callBridge(
      'campaignDispatch',
      { action: 'start', campaignId: id },
      {}
    );

    await recordAudit({
      actor: 'admin:mock',
      action: 'campaign_start',
      targetTable: 'campaigns',
      targetId: id,
      summary: bridgeResult.ok ? 'Campaign start dispatched' : 'Campaign start requested (degraded)'
    });

    if (bridgeResult.ok) {
      const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return NextResponse.json(
          {
            id,
            state: parsed.data.state ?? 'running',
            message: parsed.data.message ?? 'Campaign start dispatched.',
            integration: bridgeHealthy('campaignDispatch')
          },
          { status: 200 }
        );
      }

      console.error('Campaign start bridge returned unexpected payload', parsed.error);
      return NextResponse.json(
        {
          id,
          state: 'running',
          message: 'Campaign start dispatched but response was invalid. Verify dispatcher payload.',
          integration: {
            target: 'campaignDispatch',
            status: 'degraded',
            reason: 'http_error',
            message: 'Campaign start bridge returned unexpected payload.'
          }
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        id,
        state: 'running',
        message: bridgeResult.message,
        integration: bridgeDegraded('campaignDispatch', bridgeResult)
      },
      { status: bridgeResult.reason === 'missing_endpoint' ? 200 : 502 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_params', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to start campaign', error);
    return NextResponse.json({ error: 'campaign_start_failed' }, { status: 500 });
  }
}
