import { createHmac } from "node:crypto";
import { createServiceClient, errorResponse, parseJwt } from "../_shared/mod.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};

const loadProfile = async (supabase: ReturnType<typeof createServiceClient>, userId: string) => {
  const { data, error } = await supabase
    .schema("app")
    .from("user_profiles")
    .select("sacco_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
};

const toDate = (value: string | undefined, fallback: Date) => {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
};

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

serveWithObservability("reports-export", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const auth = parseJwt(req.headers.get("authorization"));
    if (!auth.userId) {
      return errorResponse("Missing identity", 401);
    }

    const supabase = createServiceClient();
    const profile = await loadProfile(supabase, auth.userId);

    if (!profile?.sacco_id && profile?.role !== "SYSTEM_ADMIN") {
      return errorResponse("Profile missing SACCO assignment", 403);
    }

    const { searchParams } = new URL(req.url);
    const requestedSaccoId = searchParams.get("saccoId") ?? undefined;
    const ikiminaId = searchParams.get("ikiminaId") ?? undefined;
    const startDateParam = searchParams.get("startDate") ?? undefined;
    const endDateParam = searchParams.get("endDate") ?? undefined;

    const windowStart = toDate(startDateParam, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const windowEnd = toDate(endDateParam, new Date());

    const saccoScope =
      profile?.role === "SYSTEM_ADMIN"
        ? (requestedSaccoId ?? profile?.sacco_id ?? null)
        : profile?.sacco_id;

    if (!saccoScope) {
      return errorResponse("SACCO context required", 422);
    }

    let paymentsQuery = supabase
      .schema("app")
      .from("payments")
      .select(
        `id, occurred_at, status, amount, currency, reference, sacco_id, ikimina_id, member_id,
         ikimina:ikimina(id, code, name),
         member:members(id, member_code, full_name)`
      )
      .eq("sacco_id", saccoScope)
      .gte("occurred_at", windowStart.toISOString())
      .lte("occurred_at", windowEnd.toISOString())
      .order("occurred_at", { ascending: true });

    if (ikiminaId) {
      paymentsQuery = paymentsQuery.eq("ikimina_id", ikiminaId);
    }

    const { data, error } = await paymentsQuery;

    if (error) {
      throw error;
    }

    const runningBalances = new Map<string, number>();
    const lines: string[] = [
      "occurred_at,status,amount,currency,reference,ikimina_code,ikimina_name,member_code,member_name,running_balance",
    ];

    for (const record of data ?? []) {
      const key = record.ikimina?.id ?? "default";
      const previous = runningBalances.get(key) ?? 0;
      const delta = record.status === "POSTED" ? Number(record.amount ?? 0) : 0;
      const next = previous + delta;
      runningBalances.set(key, next);

      lines.push(
        [
          csvEscape(record.occurred_at ?? ""),
          csvEscape(record.status ?? ""),
          csvEscape(record.amount ?? 0),
          csvEscape(record.currency ?? "RWF"),
          csvEscape(record.reference ?? ""),
          csvEscape(record.ikimina?.code ?? ""),
          csvEscape(record.ikimina?.name ?? ""),
          csvEscape(record.member?.member_code ?? ""),
          csvEscape(record.member?.full_name ?? ""),
          csvEscape(next.toFixed(2)),
        ].join(",")
      );
    }

    const csvBody = lines.join("\n");
    const headers = new Headers({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=report-${saccoScope}.csv`,
    });

    const signingKey = Deno.env.get("REPORT_SIGNING_KEY");
    if (signingKey) {
      const signature = createHmac("sha256", signingKey).update(csvBody).digest("hex");
      headers.set("x-report-signature", signature);
    }

    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }

    return new Response(csvBody, { headers });
  } catch (error) {
    console.error("reports-export error", error);
    return errorResponse("Unhandled error", 500);
  }
});
