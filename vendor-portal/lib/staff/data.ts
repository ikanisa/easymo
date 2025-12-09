import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/observability/logger";

export interface AllocationTriageItem {
  id: string;
  saccoName: string | null;
  decodedGroup: string | null;
  decodedMember: string | null;
  amount: number;
  matchStatus: string;
  receivedAt: string;
  rawReference: string | null;
}

export interface ReconExceptionItem {
  id: string;
  paymentId: string;
  reason: string;
  status: string;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function loadAllocationTriage(limit = 50): Promise<AllocationTriageItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("allocations")
    .select("id, sacco_name, decoded_group, decoded_member, amount, match_status, ts, raw_ref")
    .in("match_status", ["UNALLOCATED", "PENDING", "FLAGGED"])
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) {
    logError("Failed to load allocation triage queue", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    saccoName: (row as { sacco_name?: string | null }).sacco_name ?? null,
    decodedGroup: (row as { decoded_group?: string | null }).decoded_group ?? null,
    decodedMember: (row as { decoded_member?: string | null }).decoded_member ?? null,
    amount: Number((row as { amount?: number | null }).amount ?? 0),
    matchStatus: (row as { match_status?: string | null }).match_status ?? "UNKNOWN",
    receivedAt: (row as { ts?: string | null }).ts ?? new Date().toISOString(),
    rawReference: (row as { raw_ref?: string | null }).raw_ref ?? null,
  }));
}

export async function loadReconExceptions(limit = 50): Promise<ReconExceptionItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .schema("app")
    .from("recon_exceptions")
    .select("id, payment_id, reason, status, note, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logError("Failed to load recon exceptions", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    paymentId: (row as { payment_id?: string | null }).payment_id ?? "",
    reason: row.reason ?? "",
    status: row.status ?? "UNKNOWN",
    note: row.note ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    resolvedAt: row.resolved_at ?? null,
  }));
}

export async function requestAllocationExport(params: {
  saccoId?: string | null;
  referenceToken?: string | null;
  period?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.functions.invoke("export-allocation", {
    body: {
      saccoId: params.saccoId ?? null,
      referenceToken: params.referenceToken ?? null,
      period: params.period ?? null,
    },
  });

  if (error) {
    logError("Failed to queue allocation export", error);
    throw new Error(error.message ?? "Failed to queue allocation export");
  }

  return data;
}
