import { redirect } from "next/navigation";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { AdminPanelShell } from "@/components/admin/panel/panel-shell";
import type { TenantOption } from "@/components/admin/panel/types";
import { unstable_cache } from "next/cache";

// Cache tenant options for 5 minutes as they rarely change
const getCachedTenantOptions = unstable_cache(
  async (
    userId: string,
    role: string,
    saccoId: string | null,
    saccoName: string | null,
    saccoCategory: string | null
  ) => {
    return getTenantOptionsInternal(userId, role, saccoId, saccoName, saccoCategory);
  },
  ["tenant-options"],
  {
    revalidate: 300, // 5 minutes
    tags: ["tenant-options"],
  }
);

async function getTenantOptionsInternal(
  userId: string,
  role: string,
  saccoId: string | null,
  saccoName: string | null,
  saccoCategory: string | null
): Promise<TenantOption[]> {
  const supabase = createSupabaseServiceRoleClient("admin/panel/layout:getTenantOptions");

  if (role === "SYSTEM_ADMIN") {
    const { data, error } = await supabase
      .schema("app")
      .from("saccos")
      .select("id, name, status")
      .order("name", { ascending: true });

    if (error && !isMissingRelationError(error)) {
      throw error;
    }

    const rows = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name ?? "Unnamed SACCO",
      status: row.status as string | null,
    }));
    const options: TenantOption[] = [
      { id: "", name: "All SACCOs" },
      ...rows.map((row) => ({
        id: row.id,
        name: row.name,
        badge: row.status !== "ACTIVE" ? row.status : null,
      })),
    ];
    return options;
  }

  if (saccoId && saccoName) {
    return [
      {
        id: saccoId,
        name: saccoName,
        badge: saccoCategory,
      },
    ];
  }

  return [
    {
      id: "",
      name: "All SACCOs",
    },
  ];
}

async function getAlertSummary(
  profile: Awaited<ReturnType<typeof requireUserAndProfile>>["profile"]
) {
  const supabase = createSupabaseServiceRoleClient("admin/panel/layout:getAlertSummary");
  const scope = profile.role === "SYSTEM_ADMIN" ? null : (profile.sacco_id ?? null);

  let joinQuery = supabase
    .from("join_requests")
    .select("id", { head: true, count: "exact" })
    .eq("status", "pending");
  if (scope) {
    joinQuery = joinQuery.eq("sacco_id", scope);
  }

  const inviteQuery = supabase
    .from("group_invites")
    .select("id, group:ibimina(sacco_id)")
    .eq("status", "sent");

  let paymentsQuery = supabase
    .schema("app")
    .from("payments")
    .select("id", { head: true, count: "exact" })
    .in("status", ["UNALLOCATED", "PENDING"]);
  if (scope) {
    paymentsQuery = paymentsQuery.eq("sacco_id", scope);
  }

  const [join, invites, payments] = await Promise.all([joinQuery, inviteQuery, paymentsQuery]);

  const safeCount = (result: typeof join) => {
    if (result.error) {
      if (isMissingRelationError(result.error)) {
        return 0;
      }
      throw result.error;
    }
    return result.count ?? 0;
  };

  type InviteRow = { group: { sacco_id: string | null } | null };
  const inviteRows = Array.isArray(invites.data) ? (invites.data as InviteRow[]) : [];
  const scopedInvites = scope
    ? inviteRows.filter((row) => row.group?.sacco_id === scope)
    : inviteRows;

  const pendingJoins = safeCount(join);
  const pendingInvites = scopedInvites.length;
  const pendingPayments = safeCount(payments);

  return {
    approvals: pendingJoins + pendingInvites,
    reconciliation: pendingPayments,
    total: pendingPayments + pendingJoins + pendingInvites,
  };
}

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireUserAndProfile();
  if (!auth.profile) {
    redirect("/login");
  }

  const [tenantOptions, alertSummary] = await Promise.all([
    getCachedTenantOptions(
      auth.user.id,
      auth.profile.role,
      auth.profile.sacco_id,
      auth.profile.sacco?.name ?? null,
      auth.profile.sacco?.category ?? null
    ),
    getAlertSummary(auth.profile),
  ]);

  return (
    <AdminPanelShell
      profile={auth.profile}
      tenantOptions={tenantOptions}
      alertsCount={alertSummary.total}
      alertsBreakdown={{
        approvals: alertSummary.approvals,
        reconciliation: alertSummary.reconciliation,
      }}
    >
      {children}
    </AdminPanelShell>
  );
}
