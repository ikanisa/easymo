import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withIdempotency } from '@/lib/server/idempotency';
import { recordAudit } from '@/lib/server/audit';
import { mockQrTokens } from '@/lib/mock-data';

const generateSchema = z.object({
  barName: z.string().min(1),
  tableLabels: z.array(z.string().min(1)).min(1),
  batchCount: z.number().int().min(1).max(20)
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = generateSchema.parse(await request.json());
    const idempotencyKey = headers().get('x-idempotency-key') ?? undefined;

    const result = await withIdempotency(idempotencyKey, async () => {
      const generated = Array.from({ length: payload.batchCount }, (_, index) => ({
        id: `qr-${Date.now()}-${index}`,
        barName: payload.barName,
        tableLabel: payload.tableLabels[index % payload.tableLabels.length],
        token: `QR${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        printed: false,
        lastScanAt: null
      }));

      const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        const { error } = await adminClient.from('qr_tokens').insert(
          generated.map((item) => ({
            token: item.token,
            bar_name: item.barName,
            table_label: item.tableLabel,
            created_at: item.createdAt
          }))
        );
        if (error) {
          console.error('Supabase QR insert failed, using mock only', error);
        }
      } else {
        mockQrTokens.unshift(...generated);
      }

      await recordAudit({
        actor: 'admin:mock',
        action: 'qr_generate',
        targetTable: 'qr_tokens',
        targetId: generated[0]?.id ?? 'mock',
        summary: `Generated ${generated.length} QR tokens`
      });

      return { tokens: generated };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('QR generate failed', error);
    return NextResponse.json({ error: 'qr_generate_failed' }, { status: 500 });
  }
}
