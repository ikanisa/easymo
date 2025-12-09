import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import type { Database } from "@/lib/supabase/types";
import { hasSaccoReadAccess, isSystemAdmin } from "@/lib/permissions";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  saccoId: z.string().uuid().optional(),
  ikiminaId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  separator: z.enum([",", ";"]).optional(),
  limit: z.coerce.number().int().positive().max(20000).optional(),
});

const ACTIVE_STATUSES = new Set(["POSTED", "SETTLED"]);

const CSV_HEADER = [
  "occurred_at",
  "status",
  "amount",
  "currency",
  "reference",
  "ikimina_code",
  "ikimina_name",
  "member_code",
  "member_name",
  "running_balance",
] as const;

type PaymentRow = Database["app"]["Tables"]["payments"]["Row"];
type IkiminaRow = Pick<
  Database["app"]["Tables"]["ikimina"]["Row"],
  "id" | "code" | "name" | "sacco_id"
>;
type MemberRow = Pick<
  Database["public"]["Views"]["ikimina_members_public"]["Row"],
  "id" | "member_code" | "full_name"
>;

function parseDate(value: string | undefined, fallback: Date, mode: "start" | "end"): Date {
  if (!value) return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;

  const explicitDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (explicitDate) {
    const year = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const day = Number(explicitDate[3]);
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

function csvEscape(value: unknown, separator: string) {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  const needsEscaping = new RegExp(`["${separator}\\n]`).test(stringValue);
  if (!needsEscaping) {
    return stringValue;
  }
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndProfile();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { saccoId, ikiminaId, startDate, endDate, separator = ",", limit } = parsed.data;

    if (!isSystemAdmin(auth.profile) && saccoId && saccoId !== auth.profile.sacco_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createSupabaseServiceRoleClient("reports/export");

    let ikiminaRecord: IkiminaRow | null = null;
    if (ikiminaId) {
      const { data: group, error } = await supabase
        .schema("app")
        .from("ikimina")
        .select("id, code, name, sacco_id")
        .eq("id", ikiminaId)
        .maybeSingle();
      if (error) {
        logError("reports.export.ikimina_lookup_failed", { error, ikiminaId });
        return NextResponse.json({ error: "Failed to load ikimina" }, { status: 500 });
      }
      const typedGroup = (group ?? null) as IkiminaRow | null;
      if (!typedGroup) {
        return NextResponse.json({ error: "Ikimina not found" }, { status: 404 });
      }
      if (!hasSaccoReadAccess(auth.profile, typedGroup.sacco_id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      ikiminaRecord = typedGroup;
    }

    let saccoScope: string | null = null;
    if (isSystemAdmin(auth.profile)) {
      saccoScope = saccoId ?? auth.profile.sacco_id ?? ikiminaRecord?.sacco_id ?? null;
    } else {
      saccoScope = auth.profile.sacco_id ?? null;
    }

    if (!saccoScope) {
      return NextResponse.json({ error: "SACCO context required" }, { status: 422 });
    }

    if (ikiminaRecord && ikiminaRecord.sacco_id !== saccoScope) {
      return NextResponse.json(
        { error: "Ikimina does not belong to the selected SACCO" },
        { status: 400 }
      );
    }

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const windowStart = parseDate(startDate, defaultStart, "start");
    const windowEnd = parseDate(endDate, now, "end");

    if (windowStart > windowEnd) {
      return NextResponse.json({ error: "startDate must be before endDate" }, { status: 400 });
    }

    const resolvedSaccoId = saccoScope as string;

    let paymentsQuery = supabase
      .schema("app")
      .from("payments")
      .select(
        "id, sacco_id, ikimina_id, member_id, occurred_at, status, amount, currency, reference"
      )
      .eq("sacco_id", resolvedSaccoId)
      .gte("occurred_at", windowStart.toISOString())
      .lte("occurred_at", windowEnd.toISOString())
      .order("occurred_at", { ascending: true })
      .limit(limit ?? 10000);

    if (ikiminaRecord) {
      paymentsQuery = paymentsQuery.eq("ikimina_id", ikiminaRecord.id);
    }

    const { data: paymentRows, error: paymentError } = await paymentsQuery;
    if (paymentError) {
      logError("reports.export.payments_query_failed", {
        error: paymentError,
        saccoId: resolvedSaccoId,
      });
      return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
    }

    const payments = (paymentRows ?? []) as Array<PaymentRow>;

    const ikiminaIds = Array.from(
      new Set(
        payments.map((row) => row.ikimina_id).filter((value): value is string => Boolean(value))
      )
    );
    const memberIds = Array.from(
      new Set(
        payments.map((row) => row.member_id).filter((value): value is string => Boolean(value))
      )
    );

    const [ikiminaRes, membersRes] = await Promise.all([
      ikiminaIds.length
        ? supabase.from("ibimina").select("id, code, name, sacco_id").in("id", ikiminaIds)
        : Promise.resolve({ data: [] as IkiminaRow[], error: null }),
      memberIds.length
        ? supabase
            .from("ikimina_members_public")
            .select("id, member_code, full_name")
            .in("id", memberIds)
        : Promise.resolve({ data: [] as MemberRow[], error: null }),
    ]);

    if (ikiminaRes.error) {
      logError("reports.export.ibimina_lookup_failed", { error: ikiminaRes.error });
      return NextResponse.json({ error: "Failed to load ikimina records" }, { status: 500 });
    }

    if (membersRes.error) {
      logError("reports.export.members_lookup_failed", { error: membersRes.error });
      return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
    }

    const ikiminaMap = new Map<string, IkiminaRow>();
    for (const group of (ikiminaRes.data ?? []) as IkiminaRow[]) {
      ikiminaMap.set(group.id, group);
    }

    const memberMap = new Map<string, MemberRow>();
    for (const member of (membersRes.data ?? []) as MemberRow[]) {
      if (!member.id) {
        continue;
      }
      memberMap.set(member.id, member);
    }

    const runningBalances = new Map<string, number>();
    const rows: string[] = [];
    rows.push(CSV_HEADER.join(separator));

    for (const payment of payments) {
      const groupId = payment.ikimina_id ?? "unassigned";
      const previousBalance = runningBalances.get(groupId) ?? 0;
      const delta = ACTIVE_STATUSES.has(payment.status ?? "") ? Number(payment.amount ?? 0) : 0;
      const nextBalance = previousBalance + delta;
      runningBalances.set(groupId, nextBalance);

      const group = payment.ikimina_id ? (ikiminaMap.get(payment.ikimina_id) ?? null) : null;
      const member = payment.member_id ? (memberMap.get(payment.member_id) ?? null) : null;

      rows.push(
        [
          csvEscape(payment.occurred_at ?? "", separator),
          csvEscape(payment.status ?? "", separator),
          csvEscape(payment.amount ?? 0, separator),
          csvEscape(payment.currency ?? "RWF", separator),
          csvEscape(payment.reference ?? "", separator),
          csvEscape(group?.code ?? "", separator),
          csvEscape(group?.name ?? "", separator),
          csvEscape(member?.member_code ?? "", separator),
          csvEscape(member?.full_name ?? "", separator),
          csvEscape(nextBalance.toFixed(2), separator),
        ].join(separator)
      );
    }

    const csvBody = rows.join("\n");

    const headers = new Headers({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=report-${resolvedSaccoId}.csv`,
      "cache-control": "no-store",
      "x-report-row-count": String(payments.length),
    });

    const signingKey = process.env.REPORT_SIGNING_KEY;
    if (signingKey) {
      const signature = createHmac("sha256", signingKey).update(csvBody).digest("hex");
      headers.set("x-report-signature", signature);
    }

    return new NextResponse(csvBody, {
      status: 200,
      headers,
    });
  } catch (error) {
    logError("reports.export.unhandled_error", { error });
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
