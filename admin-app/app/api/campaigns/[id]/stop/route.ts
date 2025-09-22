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
        .update({ status: 'done', finished_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Failed to stop campaign in Supabase', error);
      }
    }

    const bridgeResult = await callBridge(
      'campaignDispatch',
      { action: 'stop', campaignId: id }
    );

    await recordAudit({
      actor: 'admin:mock',
      action: 'campaign_stop',
      targetTable: 'campaigns',
      targetId: id,
      summary: bridgeResult.ok ? 'Campaign stop dispatched' : 'Campaign stop requested (degraded)'
    });

    if (bridgeResult.ok) {
      const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return NextResponse.json(
          {
            id,
            state: parsed.data.state ?? 'done',
            message: parsed.data.message ?? 'Campaign stop dispatched.',
            integration: bridgeHealthy('campaignDispatch')
          },
          { status: 200 }
        );
      }
      console.error('Campaign stop bridge returned unexpected payload', parsed.error);
      return NextResponse.json(
        {
          id,
          state: 'done',
          message: 'Campaign stop dispatched but response was invalid.',
          integration: {
            target: 'campaignDispatch',
            status: 'degraded',
            reason: 'http_error',
            message: 'Campaign stop bridge returned unexpected payload.'
          }
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        id,
        state: 'done',
        message: bridgeResult.message,
        integration: bridgeDegraded('campaignDispatch', bridgeResult)
      },
      { status: bridgeResult.reason === 'missing_endpoint' ? 200 : 502 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_params', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to stop campaign', error);
    return NextResponse.json({ error: 'campaign_stop_failed' }, { status: 500 });
  }
}
