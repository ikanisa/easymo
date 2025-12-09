import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import type { SaccoSearchResult } from "@/components/saccos/sacco-search-combobox";
import { ReportsClient } from "@/app/(main)/reports/client";
import { mapSubscriptionRow } from "@/app/(main)/reports/subscription-utils";
import type { ReportSubscription } from "@/app/(main)/reports/types";

// Reports data changes infrequently, enable caching
export const revalidate = 180; // 3 minutes

interface ReportsAdminPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

export default async function ReportsAdminPage({ searchParams }: ReportsAdminPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/reports");

  let saccoQuery = supabase
    .schema("app")
    .from("saccos")
    .select("id, name, district, province, category")
    .order("name", { ascending: true });

  if (!scope.includeAll && scope.saccoId) {
    saccoQuery = saccoQuery.eq("id", scope.saccoId);
  }

  const { data: saccoRows } = await saccoQuery;
  const saccoOptions: SaccoSearchResult[] = (saccoRows ?? []).map((row) => ({
    id: String(row.id),
    name: row.name ?? "",
    district: row.district ?? "",
    province: row.province ?? "",
    category: row.category ?? "",
  }));

  const ikiminaQuery = supabase.schema("app").from("ikimina").select("id").limit(1_000);

  const { data: ikiminaRows } = scope.includeAll
    ? await ikiminaQuery
    : await ikiminaQuery.eq("sacco_id", scope.saccoId ?? "");

  const initialSacco: SaccoSearchResult | null = scope.includeAll
    ? saccoOptions.length === 1
      ? saccoOptions[0]!
      : null
    : (saccoOptions.find((option) => option.id === scope.saccoId) ?? saccoOptions[0] ?? null);

  let subscriptionQuery = supabase
    .schema("app")
    .from("report_subscriptions")
    .select(
      "id, sacco_id, email, frequency, format, delivery_hour, delivery_day, filters, is_active, last_run_at, next_run_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (!scope.includeAll && scope.saccoId) {
    subscriptionQuery = subscriptionQuery.eq("sacco_id", scope.saccoId);
  }

  const { data: subscriptionRows } = await subscriptionQuery;
  const subscriptions: ReportSubscription[] = (subscriptionRows ?? []).map((row) =>
    mapSubscriptionRow(row as Parameters<typeof mapSubscriptionRow>[0])
  );

  return (
    <ReportsClient
      initialSacco={initialSacco}
      ikiminaCount={ikiminaRows?.length ?? 0}
      saccoOptions={saccoOptions}
      subscriptions={subscriptions}
      isSystemAdmin={profile.role === "SYSTEM_ADMIN"}
      profileSaccoId={profile.sacco_id ?? null}
    />
  );
}
