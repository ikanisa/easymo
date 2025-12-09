import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheWithTags, CACHE_TAGS, REVALIDATION_SECONDS } from "@/lib/performance/cache";
import { createSupabaseServerClient, supabaseSrv } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { IkiminaTableRow } from "@/components/ikimina/ikimina-table";

const ACTIVE_PAYMENT_STATUSES = new Set(["POSTED", "SETTLED"]);

interface IkiminaDirectoryParams {
  saccoId: string | null;
  includeAll: boolean;
}

export interface IkiminaDirectoryResult {
  rows: IkiminaTableRow[];
  statusOptions: string[];
  typeOptions: string[];
  saccoOptions: string[];
}

interface IkiminaDirectoryClients {
  user: SupabaseClient<Database>;
  app: SupabaseClient<Database>;
}

async function fetchIkiminaDirectory(
  { saccoId, includeAll }: IkiminaDirectoryParams,
  clients: IkiminaDirectoryClients
): Promise<IkiminaDirectoryResult> {
  if (!includeAll && !saccoId) {
    return { rows: [], statusOptions: [], typeOptions: [], saccoOptions: [] };
  }

  const _supabase = clients.user;
  const appSupabase = clients.app;
  const baseQuery = appSupabase
    .schema("app")
    .from("ikimina")
    .select(
      "id, name, code, status, type, sacco_id, created_at, updated_at, saccos(name, district, province)"
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  // If not includeAll and no saccoId, return early (already handled above)
  // If not includeAll but have saccoId, filter by it
  const { data, error } = includeAll
    ? await baseQuery
    : saccoId
      ? await baseQuery.eq("sacco_id", saccoId)
      : { data: [], error: null };

  if (error) {
    throw error;
  }

  type IkiminaRow = Database["app"]["Tables"]["ikimina"]["Row"] & {
    saccos: { name: string | null; district: string | null; province: string | null } | null;
  };

  const rawRows = Array.isArray(data) ? (data as unknown as IkiminaRow[]) : [];
  if (rawRows.length === 0) {
    return { rows: [], statusOptions: [], typeOptions: [], saccoOptions: [] };
  }

  const groupIds = rawRows.map((row) => row.id);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWindow = new Date(now);
  startOfWindow.setDate(now.getDate() - 60);

  const memberCounts = new Map<string, number>();
  const aggregates = new Map<
    string,
    { monthTotal: number; lastPaymentAt: string | null; unallocated: number }
  >();

  if (groupIds.length > 0) {
    const memberPromise = appSupabase
      .schema("app")
      .from("members")
      .select("ikimina_id")
      .in("ikimina_id", groupIds);

    const paymentsPromise = appSupabase
      .schema("app")
      .from("payments")
      .select("ikimina_id, amount, status, occurred_at")
      .in("ikimina_id", groupIds)
      .gte("occurred_at", startOfWindow.toISOString())
      .order("occurred_at", { ascending: false })
      .range(0, 4999);

    const [memberResponse, paymentResponse] = await Promise.all([memberPromise, paymentsPromise]);

    if (memberResponse.error) {
      throw memberResponse.error;
    }

    if (paymentResponse.error) {
      throw paymentResponse.error;
    }

    type MemberCountRow = { ikimina_id: string | null };
    for (const row of (memberResponse.data ?? []) as MemberCountRow[]) {
      if (!row.ikimina_id) continue;
      memberCounts.set(row.ikimina_id, (memberCounts.get(row.ikimina_id) ?? 0) + 1);
    }

    type PaymentRow = Pick<
      Database["app"]["Tables"]["payments"]["Row"],
      "ikimina_id" | "amount" | "status" | "occurred_at"
    >;
    for (const payment of (paymentResponse.data ?? []) as PaymentRow[]) {
      const groupId = payment.ikimina_id;
      if (!groupId) continue;

      const bucket = aggregates.get(groupId) ?? {
        monthTotal: 0,
        lastPaymentAt: null,
        unallocated: 0,
      };

      const occurred = new Date(payment.occurred_at);

      if (ACTIVE_PAYMENT_STATUSES.has(payment.status ?? "") && occurred >= startOfMonth) {
        bucket.monthTotal += payment.amount ?? 0;
      }

      if (!bucket.lastPaymentAt || new Date(bucket.lastPaymentAt) < occurred) {
        bucket.lastPaymentAt = occurred.toISOString();
      }

      if (payment.status === "UNALLOCATED") {
        bucket.unallocated += 1;
      }

      aggregates.set(groupId, bucket);
    }
  }

  const rows: IkiminaTableRow[] = rawRows.map((row) => {
    const aggregate = aggregates.get(row.id);
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      type: row.type,
      members_count: memberCounts.get(row.id) ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      month_total: aggregate?.monthTotal ?? 0,
      last_payment_at: aggregate?.lastPaymentAt ?? row.updated_at,
      unallocated_count: aggregate?.unallocated ?? 0,
      sacco_name: row.saccos?.name ?? null,
    } satisfies IkiminaTableRow;
  });

  const statusOptions = Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).sort();
  const typeOptions = Array.from(new Set(rows.map((row) => row.type).filter(Boolean))).sort();
  const saccoOptions = includeAll
    ? Array.from(
        new Set(
          rows.map((row) => row.sacco_name).filter((value): value is string => Boolean(value))
        )
      ).sort()
    : [];

  return { rows, statusOptions, typeOptions, saccoOptions };
}

export async function getIkiminaDirectorySummary(
  params: IkiminaDirectoryParams
): Promise<IkiminaDirectoryResult> {
  const { saccoId, includeAll } = params;
  const keyParts = ["ikimina-directory", includeAll ? "all" : (saccoId ?? "none")];
  const supabase = await createSupabaseServerClient();
  const appSupabase = supabaseSrv();
  const cached = cacheWithTags(
    () => fetchIkiminaDirectory(params, { user: supabase, app: appSupabase }),
    keyParts,
    [CACHE_TAGS.ikiminaDirectory, CACHE_TAGS.sacco(saccoId ?? null)],
    includeAll ? REVALIDATION_SECONDS.minute : REVALIDATION_SECONDS.fiveMinutes
  );

  return cached();
}
