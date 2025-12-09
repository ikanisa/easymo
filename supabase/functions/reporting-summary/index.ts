import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummaryRequest {
  saccoId?: string;
  district?: string;
  startDate: string;
  endDate: string;
}

const parseDate = (input: string, fallback: Date) => {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
};

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

serveWithObservability("reporting-summary", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as SummaryRequest;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    if (!payload?.startDate || !payload?.endDate) {
      throw new Error("startDate and endDate are required");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const start = parseDate(payload.startDate, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const end = parseDate(payload.endDate, new Date());

    let saccoIds: string[] | undefined;

    if (payload.saccoId) {
      saccoIds = [payload.saccoId];
    } else if (payload.district) {
      const { data: saccoRows } = await supabase
        .schema("app")
        .from("saccos")
        .select("id")
        .eq("district", payload.district);

      saccoIds = (saccoRows ?? []).map((row) => row.id as string);
    }

    let paymentsQuery = supabase
      .schema("app")
      .from("payments")
      .select("id, sacco_id, ikimina_id, amount, occurred_at, status")
      .gte("occurred_at", start.toISOString())
      .lte("occurred_at", end.toISOString());

    if (saccoIds?.length) {
      paymentsQuery = paymentsQuery.in("sacco_id", saccoIds);
    }

    const { data: paymentsData, error: paymentsError } = await paymentsQuery;

    if (paymentsError) {
      throw paymentsError;
    }

    const activeStatuses = new Set(["POSTED", "SETTLED"]);
    const actionableStatuses = new Set(["UNALLOCATED", "PENDING"]);

    const totals = {
      rangeDeposits: 0,
      today: 0,
      week: 0,
      month: 0,
    };

    const contributionsByDay = new Map<string, number>();
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let unallocated = 0;
    let exceptions = 0;

    for (const payment of paymentsData ?? []) {
      const occurred = new Date(payment.occurred_at);
      const occurredDateKey = toDateOnly(occurred);

      if (activeStatuses.has(payment.status)) {
        totals.rangeDeposits += payment.amount;
        contributionsByDay.set(
          occurredDateKey,
          (contributionsByDay.get(occurredDateKey) ?? 0) + payment.amount
        );

        if (occurred >= startOfToday) {
          totals.today += payment.amount;
        }
        if (occurred >= startOfWeek) {
          totals.week += payment.amount;
        }
        if (occurred >= startOfMonth) {
          totals.month += payment.amount;
        }
      }

      if (payment.status === "UNALLOCATED") {
        unallocated += 1;
      }
      if (actionableStatuses.has(payment.status)) {
        exceptions += 1;
      }
    }

    const { data: ikiminaRows, error: ikiminaError } = await supabase
      .schema("app")
      .from("ikimina")
      .select("id, name, code, status, sacco_id");

    if (ikiminaError) {
      throw ikiminaError;
    }

    const activeIbimina = (ikiminaRows ?? []).filter((row) => row.status === "ACTIVE").length;

    const { data: membersRows } = await supabase.schema("app").from("members").select("id, status");

    const activeMembers = (membersRows ?? []).filter((row) => row.status === "ACTIVE").length;

    const totalsByIkimina = new Map<string, { amount: number; name: string; code: string }>();

    for (const payment of paymentsData ?? []) {
      if (!payment.ikimina_id || !activeStatuses.has(payment.status)) continue;
      const match = (ikiminaRows ?? []).find((row) => row.id === payment.ikimina_id);
      if (!match) continue;
      const key = payment.ikimina_id;
      const current = totalsByIkimina.get(key) ?? { amount: 0, name: match.name, code: match.code };
      current.amount += payment.amount;
      totalsByIkimina.set(key, current);
    }

    const topIkimina = Array.from(totalsByIkimina.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    let recentQuery = supabase
      .schema("app")
      .from("payments")
      .select("id, txn_id, reference, amount, occurred_at, status, ikimina:ikimina(name)")
      .order("occurred_at", { ascending: false })
      .limit(10);

    if (saccoIds?.length) {
      recentQuery = recentQuery.in("sacco_id", saccoIds);
    }

    const { data: recentPayments, error: recentError } = await recentQuery;

    if (recentError) {
      throw recentError;
    }

    return new Response(
      JSON.stringify({
        totals,
        counts: {
          activeIbimina,
          activeMembers,
          unallocated,
          exceptions,
        },
        contributionsByDay: Array.from(contributionsByDay.entries())
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        topIkimina,
        recentPayments,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
