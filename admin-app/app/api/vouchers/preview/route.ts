import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';
import { createHandler } from '@/app/api/withObservability';

const requestSchema = z.object({
  voucherId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(1).optional(),
  code: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  barName: z.string().optional()
});

export const POST = createHandler('admin_api.vouchers.preview', async (request: Request) => {
  let payload: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    payload = requestSchema.parse(json);
  } catch (error) {
    return zodValidationError(error);
  }

  const idempotencyKey = headers().get('x-idempotency-key') ?? undefined;

  const bridgeResult = await callBridge<{ imageUrl?: string | null; pdfUrl?: string | null; expiresAt?: string | null }>(
    'voucherPreview',
    payload,
    {
      idempotencyKey
    }
  );

  if (!bridgeResult.ok) {
    const status = bridgeResult.status ?? 503;
    return jsonError({ integration: { status: 'degraded' as const, target: 'voucher_preview', message: bridgeResult.message } }, status);
  }

  logStructured({
    event: 'voucher_preview_success',
    target: 'voucher_preview',
    status: 'ok',
    details: {
      voucherId: payload.voucherId ?? null
    }
  });

  return jsonOk({
    imageUrl: bridgeResult.data?.imageUrl ?? null,
    pdfUrl: bridgeResult.data?.pdfUrl ?? null,
    expiresAt: bridgeResult.data?.expiresAt ?? payload.expiresAt ?? null,
    integration: { status: 'ok' as const, target: 'voucher_preview' }
  });
});
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
