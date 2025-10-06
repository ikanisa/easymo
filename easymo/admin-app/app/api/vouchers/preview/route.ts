import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callBridge } from '@/lib/server/edge-bridges';
import { logStructured } from '@/lib/server/logger';

const requestSchema = z.object({
  voucherId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(1).optional(),
  code: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  barName: z.string().optional()
});

export async function POST(request: Request) {
  let payload: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    payload = requestSchema.parse(json);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
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
    return NextResponse.json(
      {
        integration: {
          status: 'degraded' as const,
          target: 'voucher_preview',
          message: bridgeResult.message
        }
      },
      { status }
    );
  }

  logStructured({
    event: 'voucher_preview_success',
    target: 'voucher_preview',
    status: 'ok',
    details: {
      voucherId: payload.voucherId ?? null
    }
  });

  return NextResponse.json(
    {
      imageUrl: bridgeResult.data?.imageUrl ?? null,
      pdfUrl: bridgeResult.data?.pdfUrl ?? null,
      expiresAt: bridgeResult.data?.expiresAt ?? payload.expiresAt ?? null,
      integration: {
        status: 'ok' as const,
        target: 'voucher_preview'
      }
    },
    { status: 200 }
  );
}
