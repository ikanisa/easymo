export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { withIdempotency } from '@/lib/server/idempotency';
import { callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { createHandler } from '@/app/api/withObservability';

const requestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1),
  recipients: z.array(
    z.object({
      msisdn: z.string().min(5),
      userId: z.string().uuid().optional()
    })
  ).min(1),
  stationScope: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.any()).optional()
});

function generateVoucherCode(): string {
  return `K${Math.random().toString(36).slice(-5).toUpperCase()}`;
}

export const POST = createHandler('admin_api.vouchers.generate', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({
      error: 'supabase_unavailable',
      message: 'Supabase service role not configured. Unable to issue real vouchers.',
      integration: {
        status: 'degraded' as const,
        target: 'voucher_generate',
        message: 'Voucher issuance bridge unavailable. Configure SUPABASE_SERVICE_ROLE_KEY.'
      }
    }, 503);
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    parsed = requestSchema.parse(json);
  } catch (error) {
    return zodValidationError(error);
  }

  const idempotencyKey = headers().get('x-idempotency-key') ?? undefined;
  let actorId: string | null = null;
  try {
    actorId = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
  }

  try {
    const result = await withIdempotency(idempotencyKey, async () => {
      const timestamp = new Date().toISOString();
      const rows = parsed.recipients.map((recipient) => ({
        user_id: recipient.userId ?? null,
        amount: parsed.amount,
        currency: parsed.currency,
        station_scope: parsed.stationScope ?? null,
        code5: generateVoucherCode(),
        status: 'issued',
        issued_at: timestamp,
        expires_at: parsed.expiresAt ?? null,
        created_by: actorId ?? null,
        campaign_id: parsed.campaignId ?? null,
        metadata: {
          msisdn: recipient.msisdn,
          ...(parsed.metadata ?? {})
        }
      }));

      const { data, error } = await adminClient
        .from('vouchers')
        .insert(rows)
        .select('*');

      if (error || !data) {
        logStructured({
          event: 'voucher_insert_failed',
          target: 'vouchers',
          status: 'error',
          message: 'Supabase insert failed while generating vouchers.',
          details: { error: error?.message }
        });
        throw new Error('failed_to_insert_vouchers');
      }

      const bridgeResult = await callBridge<{ issuedCount?: number }>('voucherGenerate', {
        vouchers: data.map((voucher, index) => ({
          id: voucher.id,
          msisdn: parsed.recipients[index]?.msisdn,
          code5: voucher.code5,
          amount: voucher.amount,
          currency: voucher.currency,
          expiresAt: voucher.expires_at
        }))
      }, { idempotencyKey });

      const integration = bridgeResult.ok
        ? { status: 'ok' as const, target: 'voucher_generate', details: bridgeResult.data ?? {} }
        : {
            status: 'degraded' as const,
            target: 'voucher_generate',
            message: bridgeResult.message
          };

      await recordAudit({
        actorId,
        action: 'voucher_generate',
        targetTable: 'vouchers',
        targetId: data[0]?.id ?? 'batch',
        diff: {
          count: data.length,
          campaignId: parsed.campaignId ?? null,
          stationScope: parsed.stationScope ?? null
        }
      });

      logStructured({
        event: 'voucher_generate',
        target: 'vouchers',
        status: integration.status,
        message: 'Vouchers issued.',
        details: {
          count: data.length,
          campaignId: parsed.campaignId ?? null,
          stationScope: parsed.stationScope ?? null
        }
      });

      return {
        vouchers: data.map((voucher, index) => ({
          id: voucher.id,
          code5: voucher.code5,
          msisdn: parsed.recipients[index]?.msisdn ?? null,
          status: voucher.status
        })),
        integration
      };
    });

    return jsonOk(result);
  } catch (error) {
    const status = error instanceof Error && error.message === 'failed_to_insert_vouchers' ? 500 : 500;
    return jsonError({ error: 'voucher_generate_failed', message: 'Unable to issue vouchers. Try again later.' }, status);
  }
});
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
