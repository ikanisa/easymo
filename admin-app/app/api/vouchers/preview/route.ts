import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bridgeDegraded, bridgeHealthy, callBridge } from '@/lib/server/edge-bridges';

const previewInputSchema = z.object({
  voucherId: z.string().min(1)
});

const bridgePayloadSchema = z
  .object({
    status: z.enum(['ready', 'pending', 'degraded']).default('ready'),
    message: z.string().optional(),
    imageUrl: z.string().url().optional(),
    pdfUrl: z.string().url().optional(),
    expiresAt: z.string().datetime().optional()
  })
  .passthrough();

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { voucherId } = previewInputSchema.parse(body);

    const bridgeResult = await callBridge('voucherPreview', { voucherId });

    if (bridgeResult.ok) {
      const parsed = bridgePayloadSchema.safeParse(bridgeResult.data);
      if (parsed.success) {
        return NextResponse.json(
          {
            voucherId,
            status: parsed.data.status,
            message: parsed.data.message ?? 'Voucher preview ready.',
            imageUrl: parsed.data.imageUrl ?? null,
            pdfUrl: parsed.data.pdfUrl ?? null,
            expiresAt: parsed.data.expiresAt ?? null,
            integration: bridgeHealthy('voucherPreview')
          },
          { status: 200 }
        );
      }

      console.error('Voucher preview bridge returned unexpected payload', parsed.error);
      return NextResponse.json(
        {
          voucherId,
          status: 'degraded',
          message: 'Voucher preview response invalid. Showing design mock instead.',
          integration: {
            target: 'voucherPreview',
            status: 'degraded',
            reason: 'http_error',
            message: 'Voucher preview bridge returned unexpected payload.'
          }
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        voucherId,
        status: bridgeResult.reason === 'missing_endpoint' ? 'not_configured' : 'degraded',
        message: bridgeResult.message,
        integration: bridgeDegraded('voucherPreview', bridgeResult)
      },
      { status: bridgeResult.reason === 'missing_endpoint' ? 200 : 502 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to preview voucher', error);
    return NextResponse.json({ error: 'voucher_preview_failed' }, { status: 500 });
  }
}
