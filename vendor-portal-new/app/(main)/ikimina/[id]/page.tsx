import { notFound } from "next/navigation";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { IkiminaDetailTabs } from "@/components/ikimina/ikimina-detail-tabs";
import type { Database } from "@/lib/supabase/types";
import { hasSaccoReadAccess } from "@/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function IkiminaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requireUserAndProfile();
  const supabase = await createSupabaseServerClient();

  const { data: group, error } = await supabase
    .schema("app")
    .from("ikimina")
    .select(
      "id, name, code, status, type, sacco_id, settings_json, saccos(name, district, province)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!group) notFound();

  type GroupRow = Database["app"]["Tables"]["ikimina"]["Row"] & {
    saccos: { name: string | null; district: string | null; province: string | null } | null;
  };

  const resolvedGroup = group as GroupRow;

  if (!hasSaccoReadAccess(profile, resolvedGroup.sacco_id)) notFound();

  const [membersRes, paymentsRes, membersCountRes] = await Promise.all([
    supabase
      .from("ikimina_members_public")
      .select("id, full_name, member_code, msisdn, status, joined_at, ikimina_id")
      .eq("ikimina_id", id)
      .order("joined_at", { ascending: false }),
    supabase
      .schema("app")
      .from("payments")
      .select("*")
      .eq("ikimina_id", id)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("ikimina_members_public")
      .select("id", { count: "exact", head: true })
      .eq("ikimina_id", id),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (membersCountRes.error) throw membersCountRes.error;

  type MemberRow = Database["public"]["Views"]["ikimina_members_public"]["Row"];
  type PaymentRow = Database["app"]["Tables"]["payments"]["Row"];

  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const members = (membersRes.data ?? []) as MemberRow[];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const postedStatuses = new Set(["POSTED", "SETTLED"]);

  const postedPayments = payments.filter((payment) => postedStatuses.has(payment.status));
  const monthTotal = postedPayments
    .filter((payment) => new Date(payment.occurred_at) >= startOfMonth)
    .reduce((acc, payment) => acc + payment.amount, 0);

  const unallocatedCount = payments.filter((payment) => payment.status === "UNALLOCATED").length;
  const onTimeRate =
    payments.length === 0 ? 100 : Math.round((postedPayments.length / payments.length) * 100);
  const lastDepositAt = postedPayments[0]?.occurred_at ?? null;
  const activeMembers = members.filter((member) => member.status === "ACTIVE").length;

  const monthlySummaryMap = new Map<
    string,
    {
      label: string;
      postedTotal: number;
      unallocatedTotal: number;
      transactionCount: number;
      timestamp: number;
    }
  >();

  payments.forEach((payment) => {
    const occurred = new Date(payment.occurred_at);
    const monthKey = `${occurred.getFullYear()}-${String(occurred.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlySummaryMap.get(monthKey) ?? {
      label: occurred.toLocaleString("en-US", { month: "short", year: "numeric" }),
      postedTotal: 0,
      unallocatedTotal: 0,
      transactionCount: 0,
      timestamp: occurred.getTime(),
    };

    if (postedStatuses.has(payment.status)) {
      existing.postedTotal += payment.amount;
    }

    if (payment.status === "UNALLOCATED") {
      existing.unallocatedTotal += payment.amount;
    }

    existing.transactionCount += 1;
    monthlySummaryMap.set(monthKey, existing);
  });

  const statements = Array.from(monthlySummaryMap.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );

  const recentTotal = postedPayments.reduce((acc, payment) => acc + payment.amount, 0);

  const { data: historyRows } = await supabase
    .schema("app")
    .from("audit_logs")
    .select("id, action, created_at, diff, actor")
    .eq("entity", "ibimina")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const typedHistory = (historyRows ?? []) as Array<{
    id: string;
    action: string;
    created_at: string | null;
    diff: Record<string, unknown> | null;
    actor: string | null;
  }>;

  const actorIds = Array.from(
    new Set(typedHistory.map((row) => row.actor).filter((value): value is string => Boolean(value)))
  );
  let actorMap = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase.from("users").select("id, email").in("id", actorIds);
    if (actors) {
      actorMap = new Map(
        actors.map((row: { id: string; email: string | null }) => [row.id, row.email])
      );
    }
  }

  const history = typedHistory.map((row) => ({
    id: row.id,
    action: row.action,
    actorLabel: row.actor ? (actorMap.get(row.actor) ?? row.actor) : "System",
    createdAt: row.created_at ?? new Date().toISOString(),
    diff: (row.diff as Record<string, unknown> | null) ?? null,
  }));

  return (
    <IkiminaDetailTabs
      detail={{
        id: resolvedGroup.id,
        name: resolvedGroup.name,
        code: resolvedGroup.code,
        status: resolvedGroup.status,
        type: resolvedGroup.type,
        saccoName: resolvedGroup.saccos?.name ?? null,
        saccoDistrict: resolvedGroup.saccos?.district ?? null,
        saccoId: resolvedGroup.sacco_id,
        settings: resolvedGroup.settings_json as Record<string, unknown> | null,
        membersCount: membersCountRes.count ?? members.length,
        recentTotal,
        analytics: {
          monthTotal,
          onTimeRate,
          unallocatedCount,
          lastDepositAt,
          activeMembers,
          totalMembers: members.length,
        },
      }}
      members={members}
      payments={payments}
      statements={statements}
      history={history}
    />
  );
}
