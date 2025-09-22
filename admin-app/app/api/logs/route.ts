import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/lib/server/audit';
import { mockAuditEvents, mockOrderEvents } from '@/lib/mock-data';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { limit } = querySchema.parse({ limit: searchParams.get('limit') ?? undefined });
  const limitValue = limit ?? 100;
  let integration: { target: string; status: 'ok' | 'degraded'; reason?: string; message?: string } = {
    target: 'logs',
    status: 'degraded',
    reason: 'mock_data',
    message: 'Supabase audit log unavailable; returning mock entries.'
  };

  try {
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');
    const adminClient = getSupabaseAdminClient();

    if (adminClient) {
      const { data: audit } = await adminClient
        .from('audit_log')
        .select('id, actor, action, target_table, target_id, diff, created_at')
        .order('created_at', { ascending: false })
        .limit(limitValue);

      if (audit) {
        integration = { target: 'logs', status: 'ok' };
        return NextResponse.json({
          audit,
          events: mockOrderEvents.slice(0, limitValue),
          integration
        });
      }
    }
  } catch (error) {
    console.error('Logs fetch failed, using mocks', error);
  }

  return NextResponse.json({
    audit: mockAuditEvents.slice(0, limitValue),
    events: mockOrderEvents.slice(0, limitValue),
    integration
  });
}
