import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateOutboundPolicy } from '@/lib/server/policy';
import { withIdempotency } from '@/lib/server/idempotency';
import { recordAudit } from '@/lib/server/audit';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { bridgeDegraded, bridgeHealthy, callBridge } from '@/lib/server/edge-bridges';

const sendInputSchema = z.object({
  voucherId: z.string().min(1),
  msisdn: z.string().min(5),
  templateId: z.string().default('voucher_issue')
});

const bridgeResponseSchema = z
  .object({
    status: z.enum(['queued', 'sent', 'delivered', 'blocked']).optional(),
    message: z.string().optional(),
    providerId: z.string().optional()
  })
  .passthrough();

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = sendInputSchema.parse(body);
    const idempotencyKey = headers().get('x-idempotency-key') ?? undefined;

    const policy = await evaluateOutboundPolicy(payload.msisdn);
    if (!policy.allowed) {
      return NextResponse.json(
        {
          voucherId: payload.voucherId,
          status: 'blocked',
          reason: policy.reason,
          message: policy.message
        },
        { status: 409 }
      );
    }

    const result = await withIdempotency(idempotencyKey, async () => {
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        const { error } = await adminClient
          .from('vouchers')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', payload.voucherId);

        if (!error) {
          await recordAudit({
            actor: 'admin:mock',
            action: 'voucher_send',
            targetTable: 'vouchers',
            targetId: payload.voucherId,
            summary: `Voucher sent via template ${payload.templateId}`
          });

          return {
            voucherId: payload.voucherId,
            status: 'queued',
            message: 'Voucher marked as sent.'
          };
        }

        console.error('Supabase voucher send update failed, using mock fallback', error);
      }

      await recordAudit({
        actor: 'admin:mock',
        action: 'voucher_send',
        targetTable: 'vouchers',
        targetId: payload.voucherId,
        summary: `Send voucher template ${payload.templateId} (mock)`
      });

      const bridgeResult = await callBridge(
        'voucherSend',
        {
          voucherId: payload.voucherId,
          msisdn: payload.msisdn,
          templateId: payload.templateId
        },
        { idempotencyKey }
      );

      if (bridgeResult.ok) {
        const parsed = bridgeResponseSchema.safeParse(bridgeResult.data);
        if (parsed.success) {
          return {
            voucherId: payload.voucherId,
            status: parsed.data.status ?? 'queued',
            message: parsed.data.message ?? 'Voucher dispatch queued.',
            providerId: parsed.data.providerId ?? null,
            integration: bridgeHealthy('voucherSend')
          };
        }
        console.error('Voucher send bridge returned unexpected payload', parsed.error);
        return {
          voucherId: payload.voucherId,
          status: 'queued',
          message: 'Voucher dispatched but response was invalid. Verify WhatsApp bridge payload.',
          integration: {
            target: 'voucherSend',
            status: 'degraded',
            reason: 'http_error',
            message: 'Voucher send bridge returned unexpected payload.'
          }
        };
      }

      return {
        voucherId: payload.voucherId,
        status: 'queued',
        message: bridgeResult.message,
        integration: bridgeDegraded('voucherSend', bridgeResult)
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to send voucher', error);
    return NextResponse.json({ error: 'voucher_send_failed' }, { status: 500 });
  }
}
