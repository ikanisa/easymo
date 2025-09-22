import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withIdempotency } from '@/lib/server/idempotency';
import { recordAudit } from '@/lib/server/audit';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { bridgeDegraded, bridgeHealthy, callBridge } from '@/lib/server/edge-bridges';

const voucherRecipientSchema = z.object({
  userId: z.string().optional(),
  msisdn: z.string().min(5)
});

const generateInputSchema = z.object({
  amount: z.number().min(1).default(2000),
  currency: z.string().default('RWF'),
  expiresAt: z.string().datetime().nullable().optional(),
  stationScope: z.string().nullable().optional(),
  recipients: z.array(voucherRecipientSchema).min(1)
});

const bridgeVoucherItemSchema = z
  .object({
    voucherId: z.string().optional(),
    id: z.string().optional(),
    msisdn: z.string(),
    status: z.string().optional()
  })
  .refine((value) => Boolean(value.voucherId ?? value.id), {
    message: 'Voucher identifier missing from bridge response'
  })
  .transform((value) => ({
    voucherId: value.voucherId ?? value.id!,
    msisdn: value.msisdn,
    status: value.status ?? 'issued'
  }));

const bridgeGenerateSchema = z
  .object({
    vouchers: z.array(bridgeVoucherItemSchema).min(1),
    message: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    stationScope: z.string().nullable().optional()
  })
  .passthrough();

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = generateInputSchema.parse(body);
    const idempotencyKey = headers().get('x-idempotency-key') ?? undefined;

    const result = await withIdempotency(idempotencyKey, async () => {
      const bridgeResult = await callBridge(
        'voucherGenerate',
        {
          amount: payload.amount,
          currency: payload.currency,
          expiresAt: payload.expiresAt ?? null,
          stationScope: payload.stationScope ?? null,
          recipients: payload.recipients
        },
        { idempotencyKey }
      );

      if (bridgeResult.ok) {
        const parsed = bridgeGenerateSchema.safeParse(bridgeResult.data);
        if (parsed.success) {
          const vouchers = parsed.data.vouchers.map((entry) => ({
            voucherId: entry.voucherId,
            msisdn: entry.msisdn,
            status: entry.status
          }));

          await recordAudit({
            actor: 'admin:mock',
            action: 'voucher_generate',
            targetTable: 'vouchers',
            targetId: vouchers[0]?.voucherId ?? 'unknown',
            summary: `Issued ${vouchers.length} vouchers via bridge`
          });

          return {
            issuedCount: vouchers.length,
            amount: parsed.data.amount ?? payload.amount,
            currency: parsed.data.currency ?? payload.currency,
            expiresAt: parsed.data.expiresAt ?? payload.expiresAt ?? null,
            stationScope: parsed.data.stationScope ?? payload.stationScope ?? null,
            vouchers,
            message: parsed.data.message ?? 'Voucher generation successful via Edge Function.',
            integration: bridgeHealthy('voucherGenerate')
          };
        }

        console.error('Voucher generate bridge returned unexpected payload', parsed.error);
      }

      const adminClient = getSupabaseAdminClient();
      const now = new Date();
      const generatedVouchers = payload.recipients.map((recipient, index) => ({
        id: crypto.randomUUID(),
        user_id: payload.recipients[index].userId ?? null,
        amount: payload.amount,
        currency: payload.currency,
        status: 'issued' as const,
        station_scope: payload.stationScope ?? null,
        expires_at: payload.expiresAt ?? null,
        msisdn: recipient.msisdn,
        code5: String(Math.floor(10000 + Math.random() * 90000)),
        issued_at: now.toISOString()
      }));

      const integrationNotice = bridgeResult.ok
        ? {
            target: 'voucherGenerate' as const,
            status: 'degraded' as const,
            reason: 'http_error' as const,
            message: 'Voucher issuance bridge returned unexpected payload. Falling back to local generator.'
          }
        : bridgeDegraded('voucherGenerate', bridgeResult);

      if (adminClient) {
        const { data, error } = await adminClient
          .from('vouchers')
          .insert(generatedVouchers)
          .select('id, msisdn, status');

        if (!error && data) {
          await recordAudit({
            actor: 'admin:mock',
            action: 'voucher_generate',
            targetTable: 'vouchers',
            targetId: data[0]?.id ?? 'unknown',
            summary: `Issued ${data.length} vouchers`
          });

          return {
            issuedCount: data.length,
            amount: payload.amount,
            currency: payload.currency,
            expiresAt: payload.expiresAt ?? null,
            stationScope: payload.stationScope ?? null,
            vouchers: data.map((item) => ({
              voucherId: item.id,
              msisdn: item.msisdn,
              status: item.status
            })),
            message: bridgeResult.ok
              ? 'Voucher generation completed with degraded bridge payload. Supabase persisted records.'
              : 'Voucher generation successful.',
            integration: integrationNotice
          };
        }

        console.error('Supabase voucher insert failed, falling back to mock', error);
      }

      const fallback = generatedVouchers.map((item) => ({
        voucherId: item.id,
        msisdn: item.msisdn,
        status: item.status
      }));

      await recordAudit({
        actor: 'admin:mock',
        action: 'voucher_generate',
        targetTable: 'vouchers',
        targetId: fallback[0]?.voucherId ?? 'mock',
        summary: `Issued ${fallback.length} vouchers (mock).`
      });

      return {
        issuedCount: fallback.length,
        amount: payload.amount,
        currency: payload.currency,
        expiresAt: payload.expiresAt ?? null,
        stationScope: payload.stationScope ?? null,
        vouchers: fallback,
        message: 'Mock voucher generation successful. No records were persisted.',
        integration: integrationNotice
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to generate vouchers', error);
    return NextResponse.json({ error: 'voucher_generate_failed' }, { status: 500 });
  }
}
