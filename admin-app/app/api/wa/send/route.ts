export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { sendWhatsAppMessage } from '@/lib/server/whatsapp';

const payloadSchema = z.record(z.unknown());

export const POST = createHandler('wa.send', async (request) => {
  let payload: Record<string, unknown>;
  try {
    payload = payloadSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  try {
    const response = await sendWhatsAppMessage(payload);
    if (!response) {
      return NextResponse.json({ status: 'skipped', reason: 'endpoint_not_configured' }, { status: 202 });
    }
    return NextResponse.json({ status: 'sent' });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'whatsapp_send_failed',
        message: error instanceof Error ? error.message : 'Unknown send error',
      },
      { status: 502 },
    );
  }
});

export const runtime = "edge";
