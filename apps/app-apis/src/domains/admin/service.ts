import { cached } from "@app-apis/lib/cache";
import type { DomainHandlerContext } from "@app-apis/lib/createDomainHandler";
import { getSupabaseRepositories } from "@app-apis/lib/supabase";
import { measure } from "@app-apis/lib/perf";
import type { AdminQuery, AdminResponse } from "@app-apis/domains/admin/schemas";

export const listAdminAudit = async (
  context: DomainHandlerContext,
  query: AdminQuery
): Promise<AdminResponse> => {
  const cacheKey = `admin:${query.page}:${query.pageSize}`;
  return cached(cacheKey, async () => {
    const repositories = getSupabaseRepositories();
    const result = await measure("admin.repository", () =>
      repositories.admin.list(context, {
        page: query.page,
        pageSize: query.pageSize,
      })
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.created_at,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
      },
    };
  });
};
