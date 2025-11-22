export const dynamic = 'force-dynamic';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { jsonError, jsonOk, zodValidationError } from '@/lib/api/http';
import { mockAuditEvents } from '@/lib/mock-data';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  actor: z.string().optional(),
  targetTable: z.string().optional()
});

function mockResponse(message: string, filters?: z.infer<typeof querySchema>) {
  const filtered = mockAuditEvents.filter((entry: any) => {
    const actorMatch = filters?.actor
      ? entry.actor.toLowerCase().includes(filters.actor.toLowerCase())
      : true;
    const targetMatch = filters?.targetTable
      ? entry.targetTable.toLowerCase().includes(filters.targetTable.toLowerCase())
      : true;
    return actorMatch && targetMatch;
  });

  return jsonOk({
    audit: filtered.map((entry: any) => ({
      id: entry.id,
      actor: entry.actor,
      action: entry.action,
      target_table: entry.targetTable,
      target_id: entry.targetId,
      created_at: entry.createdAt,
      diff: entry.summary ? { summary: entry.summary } : null
    })),
    events: [],
    integration: {
      status: 'degraded' as const,
      target: 'logs',
      message
    }
  });
}

export const GET = createHandler('admin_api.logs.list', async (request: Request) => {
  let query: z.infer<typeof querySchema>;
  try {
    query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return mockResponse('Supabase credentials missing. Showing mock audit log.', query);
  }

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const auditQuery = adminClient
    .from('audit_log')
    .select('id, actor_id, action, target_table, target_id, diff, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.actor) {
    auditQuery.eq('actor_id', query.actor);
  }
  if (query.targetTable) {
    auditQuery.eq('target_table', query.targetTable);
  }

  try {
    const audit = await auditQuery;

    const integrationMessages: string[] = [];

    const auditEntries = (audit.data ?? []).map((row) => ({
      id: row.id,
      actor: row.actor_id ?? 'unknown',
      action: row.action,
      target_table: row.target_table,
      target_id: row.target_id ?? 'unknown',
      created_at: row.created_at,
      diff: row.diff ?? null
    }));

    if (!auditEntries.length && (audit.count ?? 0) > 0) {
      integrationMessages.push('Audit log returned empty results.');
    }

    const responseBody: Record<string, unknown> = {
      audit: auditEntries,
      events: [],
      totals: {
        audit: audit.count ?? auditEntries.length,
        events: 0
      }
    };

    if (integrationMessages.length) {
      responseBody.integration = {
        status: 'degraded' as const,
        target: 'logs',
        message: integrationMessages.join(' ')
      };
    }

    return jsonOk(responseBody);
  } catch (error) {
    logStructured({
      event: 'logs_fetch_failed',
      target: 'logs',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return mockResponse('Supabase logs query failed. Showing mock audit log.', query);
  }
});

export const runtime = "nodejs";
