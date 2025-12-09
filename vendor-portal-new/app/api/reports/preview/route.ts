import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { hasSaccoReadAccess, isSystemAdmin } from "@/lib/permissions";

const payloadSchema = z.object({
  saccoId: z.string().uuid().nullable().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

type PaymentRow = {
  id: string;
  sacco_id: string | null;
  ikimina_id: string | null;
  amount: number;
  currency: string | null;
  status: string;
  occurred_at: string;
  group: { id: string; name: string | null; code: string | null } | null;
};

const ACTIVE_STATUSES = new Set(["POSTED", "SETTLED"]);
const MAX_ROWS = 2000;

function resolveDate(value: string | undefined, fallback: Date, mode: "start" | "end"): Date {
  if (!value) return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;

  const explicit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (explicit) {
    const year = Number(explicit[1]);
    const month = Number(explicit[2]) - 1;
    const day = Number(explicit[3]);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return fallback;
    }
    if (mode === "start") {
      return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    }
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
}

export async function POST(request: NextRequest) {
  const auth = await requireUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payloadRaw: unknown;
  try {
    payloadRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(payloadRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { saccoId: requestedSaccoId, from, to } = parsed.data;
  const supabase = createSupabaseServiceRoleClient("reports/preview");

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = resolveDate(from, defaultStart, "start");
  const endDate = resolveDate(to, now, "end");

  if (startDate > endDate) {
    return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
  }

  let saccoScope: string | null = null;
  if (isSystemAdmin(auth.profile)) {
    saccoScope = requestedSaccoId ?? auth.profile.sacco_id ?? null;
  } else {
    saccoScope = auth.profile.sacco_id ?? null;
  }

  if (saccoScope && !hasSaccoReadAccess(auth.profile, saccoScope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let paymentsQuery = supabase
    .schema("app")
    .from("payments")
    .select(
      "id, sacco_id, ikimina_id, amount, currency, status, occurred_at, group:ikimina(id, name, code)"
    )
    .gte("occurred_at", startDate.toISOString())
    .lte("occurred_at", endDate.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(MAX_ROWS);

  if (saccoScope) {
    paymentsQuery = paymentsQuery.eq("sacco_id", saccoScope);
  }

  const { data: paymentRows, error: paymentsError } = await paymentsQuery;
  if (paymentsError) {
    return NextResponse.json(
      { error: paymentsError.message ?? "Failed to load payments" },
      { status: 500 }
    );
  }

  const payments = (paymentRows ?? []) as PaymentRow[];
  const active = payments.filter((row) => ACTIVE_STATUSES.has(row.status));

  let brandColor: string | null = null;
  if (saccoScope) {
    const { data: saccoRow } = await supabase
      .schema("app")
      .from("saccos")
      .select("metadata")
      .eq("id", saccoScope)
      .maybeSingle();
    const metadata = (saccoRow as { metadata?: Record<string, unknown> } | null)?.metadata ?? null;
    const candidate = typeof metadata?.brand_color === "string" ? metadata.brand_color : null;
    brandColor =
      candidate && /^#?[0-9a-fA-F]{6}$/.test(candidate)
        ? candidate.startsWith("#")
          ? candidate
          : `#${candidate}`
        : null;
  }

  if (active.length === 0) {
    return NextResponse.json({
      summary: null,
      brandColor,
    });
  }

  const currency = active[0]?.currency ?? "RWF";
  let totalAmount = 0;
  let totalTransactions = 0;
  const groupTotals = new Map<
    string,
    { name: string; code: string; amount: number; count: number }
  >();
  const dailyTotals = new Map<string, number>();

  for (const payment of active) {
    totalAmount += payment.amount;
    totalTransactions += 1;

    const groupId = payment.ikimina_id ?? "unassigned";
    const existingGroup = groupTotals.get(groupId) ?? {
      name: payment.group?.name ?? "Unassigned",
      code: payment.group?.code ?? "—",
      amount: 0,
      count: 0,
    };
    existingGroup.amount += payment.amount;
    existingGroup.count += 1;
    groupTotals.set(groupId, existingGroup);

    const dayKey = payment.occurred_at.slice(0, 10);
    dailyTotals.set(dayKey, (dailyTotals.get(dayKey) ?? 0) + payment.amount);
  }

  const uniqueIkimina = Array.from(groupTotals.keys()).filter((id) => id !== "unassigned").length;

  const topIkimina = Array.from(groupTotals.entries())
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      code: entry.code,
      amount: entry.amount,
      transactionCount: entry.count,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const sortedDailyTotals = Array.from(dailyTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, amount]) => ({ date, amount }));

  return NextResponse.json({
    summary: {
      currency,
      totalAmount,
      totalTransactions,
      uniqueIkimina,
      topIkimina,
      dailyTotals: sortedDailyTotals,
    },
    brandColor,
  });
}
