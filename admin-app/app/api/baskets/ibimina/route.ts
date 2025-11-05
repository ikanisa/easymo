export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  saccoId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

type CommitteeMemberRow = {
  role: string | null;
  member_id: string | null;
};

type IbiminaRawRow = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: string;
  created_at: string;
  sacco_id: string | null;
  saccos: { id: string; name: string; branch_code: string | null } | null;
  committee: CommitteeMemberRow[] | null;
  settings:
    | Array<{ quorum?: unknown }>
    | { quorum?: unknown }
    | null;
};

function parseQuorum(value: unknown): { threshold: number | null; roles: string[] } | null {
  if (!value || typeof value !== 'object') return null;
  const quorum = value as { threshold?: unknown; roles?: unknown };
  const threshold = typeof quorum.threshold === 'number'
    ? quorum.threshold
    : quorum.threshold == null ? null : Number(quorum.threshold);
  const roles = Array.isArray(quorum.roles)
    ? quorum.roles.filter((role): role is string => typeof role === 'string')
    : [];
  if (threshold == null && roles.length === 0) return null;
  return {
    threshold: threshold != null && Number.isFinite(threshold) ? Number(threshold) : null,
    roles,
  };
}

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch Ibimina.' }, 503);
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  const rangeEnd = offset + limit - 1;

  const supabaseQuery = adminClient
    .from('ibimina')
    .select(
      `id, name, description, slug, status, created_at, sacco_id,
       saccos:sacco_id (id, name, branch_code),
       committee:ibimina_committee (role, member_id),
       settings:ibimina_settings!left (quorum)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, rangeEnd);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }

  if (query.saccoId) {
    supabaseQuery.eq('sacco_id', query.saccoId);
  }

  if (query.search) {
    const term = query.search;
    supabaseQuery.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'ibimina_fetch_failed',
      target: 'ibimina',
      status: 'error',
      message: error.message,
    });
    return jsonError({ error: 'ibimina_fetch_failed', message: 'Unable to load Ibimina.' }, 500);
  }

  const rows = (data ?? []) as unknown as IbiminaRawRow[];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return jsonOk({
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      slug: row.slug,
      status: row.status,
      createdAt: row.created_at,
      saccoId: row.sacco_id,
      sacco: row.saccos
        ? {
          id: row.saccos.id,
          name: row.saccos.name,
          branchCode: row.saccos.branch_code,
        }
        : null,
      committee: Array.isArray(row.committee)
        ? row.committee.map((member) => ({
          role: member.role ?? null,
          memberId: member.member_id ?? null,
        }))
        : [],
      quorum: Array.isArray(row.settings)
        ? parseQuorum(row.settings[0]?.quorum ?? null)
        : parseQuorum((row.settings as { quorum?: unknown } | null)?.quorum ?? null),
    })),
    total,
    hasMore,
  });
}
