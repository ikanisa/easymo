import { NextResponse } from 'next/server';
import { z } from 'zod';

const targetSchema = z.object({
  name: z.enum(['voucherPreview', 'whatsappSend', 'campaignDispatcher']),
  url: z.string().url(),
  method: z.enum(['HEAD', 'GET', 'POST']).default('HEAD')
});

function buildTargets() {
  const targets = [] as Array<z.infer<typeof targetSchema>>;

  if (process.env.NEXT_PUBLIC_VOUCHER_PREVIEW_ENDPOINT) {
    targets.push({
      name: 'voucherPreview',
      url: process.env.NEXT_PUBLIC_VOUCHER_PREVIEW_ENDPOINT,
      method: 'POST'
    });
  }

  if (process.env.NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT) {
    targets.push({
      name: 'whatsappSend',
      url: process.env.NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT,
      method: 'POST'
    });
  }

  if (process.env.NEXT_PUBLIC_CAMPAIGN_DISPATCHER_ENDPOINT) {
    targets.push({
      name: 'campaignDispatcher',
      url: process.env.NEXT_PUBLIC_CAMPAIGN_DISPATCHER_ENDPOINT,
      method: 'POST'
    });
  }

  return targets;
}

async function probe(url: string, method: 'HEAD' | 'GET' | 'POST') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      return { status: 'green', message: 'OK' } as const;
    }
    return { status: 'amber', message: `HTTP ${response.status}` } as const;
  } catch (error) {
    clearTimeout(timeout);
    return { status: 'red', message: error instanceof Error ? error.message : 'Unknown error' } as const;
  }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const targets = buildTargets();
  if (!targets.length) {
    return NextResponse.json({
      voucherPreview: { status: 'red', message: 'Endpoint not configured' },
      whatsappSend: { status: 'red', message: 'Endpoint not configured' },
      campaignDispatcher: { status: 'red', message: 'Endpoint not configured' }
    });
  }

  const results: Record<string, { status: string; message: string }> = {
    voucherPreview: { status: 'red', message: 'Endpoint not configured' },
    whatsappSend: { status: 'red', message: 'Endpoint not configured' },
    campaignDispatcher: { status: 'red', message: 'Endpoint not configured' }
  };

  await Promise.all(
    targets.map(async (target) => {
      const parsed = targetSchema.safeParse(target);
      if (!parsed.success) {
        return;
      }
      const { name, url, method } = parsed.data;
      const outcome = await probe(url, method as 'HEAD' | 'GET' | 'POST');
      results[name] = outcome;
    })
  );

  return NextResponse.json(results);
}
