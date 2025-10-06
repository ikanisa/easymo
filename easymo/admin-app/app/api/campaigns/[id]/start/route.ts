import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleAction } from '@/lib/server/campaign-actions';

const paramsSchema = z.object({ id: z.string().uuid() });

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_campaign_id', message: 'Invalid campaign ID.' },
      { status: 400 }
    );
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');

  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ campaignId: parsed.data.id })
  });

  return handleAction(proxyRequest, 'start');
}
