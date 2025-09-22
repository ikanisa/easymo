import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/lib/server/audit';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { bridgeDegraded, bridgeHealthy, callBridge } from '@/lib/server/edge-bridges';

const bridgeResponseSchema = z
  .object({
    status: z.string().optional(),
    message: z.string().optional()
  })
  .passthrough();

const paramsSchema = z.object({
  id: z.string().min(1)
});

const bodySchema = z.object({
  reviewerId: z.string().optional(),
  comment: z.string().min(1)
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const payload = bodySchema.parse(await request.json());

    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      const { error } = await adminClient
        .from('insurance_quotes')
        .update({ status: 'needs_changes', reviewer_comment: payload.comment })
        .eq('id', id);
      if (error) {
        console.error('Failed to request changes in Supabase', error);
      }
    }

    const bridgeResult = await callBridge(
      'insuranceWorkflow',
      { action: 'request_changes', quoteId: id, reviewerId: payload.reviewerId ?? null, comment: payload.comment }
    );

    await recordAudit({
      actor: 'admin:mock',
      action: 'insurance_request_changes',
      targetTable: 'insurance_quotes',
      targetId: id,
      summary: bridgeResult.ok ? payload.comment : `${payload.comment} (degraded)`
    });

    if (bridgeResult.ok) {
      const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return NextResponse.json(
          {
            quoteId: id,
            status: parsed.data.status ?? 'needs_changes',
            comment: payload.comment,
            message: parsed.data.message ?? 'Change request dispatched.',
            integration: bridgeHealthy('insuranceWorkflow')
          },
          { status: 200 }
        );
      }
      console.error('Insurance request-changes bridge returned unexpected payload', parsed.error);
      return NextResponse.json(
        {
          quoteId: id,
          status: 'needs_changes',
          comment: payload.comment,
          message: 'Change request dispatched but response was invalid.',
          integration: {
            target: 'insuranceWorkflow',
            status: 'degraded',
            reason: 'http_error',
            message: 'Insurance request-changes bridge returned unexpected payload.'
          }
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        quoteId: id,
        status: 'needs_changes',
        comment: payload.comment,
        message: bridgeResult.message,
        integration: bridgeDegraded('insuranceWorkflow', bridgeResult)
      },
      { status: bridgeResult.reason === 'missing_endpoint' ? 200 : 502 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_request', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to request quote changes', error);
    return NextResponse.json({ error: 'insurance_request_changes_failed' }, { status: 500 });
  }
}
