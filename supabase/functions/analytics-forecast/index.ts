import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ForecastRequest = {
  saccoId?: string;
  district?: string;
  horizonDays?: number;
};

type PaymentRow = {
  sacco_id: string;
  ikimina_id: string | null;
  amount: number;
  occurred_at: string;
  status: string;
};

type IkiminaRow = {
  id: string;
  sacco_id: string;
  name: string;
  code: string;
  settings_json: Record<string, unknown> | null;
};

type SaccoRow = {
  id: string;
  name: string;
};

type SmsRow = {
  status: string;
  received_at: string;
};

const ACTIVE_STATUSES = new Set(["POSTED", "SETTLED"]);
const DEFAULT_LOOKBACK_DAYS = parseInt(Deno.env.get("FORECAST_LOOKBACK_DAYS") ?? "120", 10);
const DEFAULT_HORIZON_DAYS = parseInt(Deno.env.get("FORECAST_HORIZON_DAYS") ?? "21", 10);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const safeNumber = (value: unknown, fallback = 0) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const parseContributionSettings = (settings: Record<string, unknown> | null | undefined) => {
  if (!settings || typeof settings !== "object") {
    return { fixedAmount: null as number | null, frequency: "MONTHLY" };
  }

  const contribution = (settings as Record<string, unknown>).contribution as
    | Record<string, unknown>
    | undefined;
  const fixedAmountRaw = contribution?.fixedAmount ?? contribution?.fixed_amount;
  const frequencyRaw = contribution?.frequency ?? contribution?.Frequency;
  const frequency = typeof frequencyRaw === "string" ? frequencyRaw.toUpperCase() : "MONTHLY";
  const fixedAmount = safeNumber(fixedAmountRaw, null as unknown as number);

  return {
    fixedAmount: Number.isFinite(fixedAmount) ? fixedAmount : null,
    frequency,
  };
};

const frequencyMultiplier: Record<string, number> = {
  DAILY: 30,
  WEEKLY: 4,
  BIWEEKLY: 2,
  MONTHLY: 1,
};

const computeRegression = (series: { amount: number }[]) => {
  const n = series.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, residualStdDev: 0 };
  }
  if (n === 1) {
    return { slope: 0, intercept: series[0].amount, residualStdDev: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  series.forEach((point, index) => {
    const x = index;
    const y = point.amount;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  let residualSum = 0;
  series.forEach((point, index) => {
    const predicted = slope * index + intercept;
    residualSum += (point.amount - predicted) ** 2;
  });

  const residualVariance = residualSum / Math.max(n - 2, 1);
  const residualStdDev = Math.sqrt(residualVariance);

  return { slope, intercept, residualStdDev };
};

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

const determineRiskLevel = (ratio: number, lastContribution: Date | null) => {
  const today = new Date();
  const ageDays = lastContribution
    ? (today.getTime() - lastContribution.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  if (ageDays > 21) {
    return "HIGH" as RiskLevel;
  }
  if (ageDays > 14) {
    return "MEDIUM" as RiskLevel;
  }

  if (ratio < 0.6) {
    return "HIGH" as RiskLevel;
  }
  if (ratio < 0.85) {
    return "MEDIUM" as RiskLevel;
  }
  return "LOW" as RiskLevel;
};

serveWithObservability("analytics-forecast", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const payload = (req.method === "GET" ? {} : await req.json()) as ForecastRequest | undefined;

    const lookbackDays = Math.max(14, DEFAULT_LOOKBACK_DAYS);
    const horizonDays = clamp(payload?.horizonDays ?? DEFAULT_HORIZON_DAYS, 7, 60);

    const start = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const startIso = start.toISOString();

    let saccoIds: string[] | undefined;
    if (payload?.saccoId) {
      saccoIds = [payload.saccoId];
    } else if (payload?.district) {
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
      .select("sacco_id, ikimina_id, amount, occurred_at, status")
      .gte("occurred_at", startIso);

    if (saccoIds?.length) {
      paymentsQuery = paymentsQuery.in("sacco_id", saccoIds);
    }

    const { data: paymentsData, error: paymentsError } = await paymentsQuery;

    if (paymentsError) {
      throw paymentsError;
    }

    const dailyTotals = new Map<string, number>();
    const now = new Date();
    const lookbackRange: { date: string; amount: number }[] = [];
    const trailing30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const riskMap = new Map<string, { total: number; last: Date | null; trailingThirty: number }>();

    for (const payment of paymentsData ?? []) {
      if (!ACTIVE_STATUSES.has(payment.status)) continue;
      const occurred = new Date(payment.occurred_at);
      const dateKey = occurred.toISOString().slice(0, 10);
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + payment.amount);

      if (payment.ikimina_id) {
        const entry = riskMap.get(payment.ikimina_id) ?? {
          total: 0,
          last: null,
          trailingThirty: 0,
        };
        entry.total += payment.amount;
        if (!entry.last || occurred > entry.last) {
          entry.last = occurred;
        }
        if (occurred >= trailing30) {
          entry.trailingThirty += payment.amount;
        }
        riskMap.set(payment.ikimina_id, entry);
      }
    }

    for (let cursor = new Date(start); cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      lookbackRange.push({ date: key, amount: dailyTotals.get(key) ?? 0 });
    }

    const regression = computeRegression(lookbackRange);
    const lastDate = lookbackRange.length
      ? new Date(lookbackRange[lookbackRange.length - 1].date)
      : new Date();
    const forecast: { date: string; projected: number; lower: number; upper: number }[] = [];

    for (let index = 1; index <= horizonDays; index += 1) {
      const projectedDate = new Date(lastDate);
      projectedDate.setDate(projectedDate.getDate() + index);
      const x = lookbackRange.length + index - 1;
      const projected = regression.slope * x + regression.intercept;
      const lower = Math.max(projected - 1.5 * regression.residualStdDev, 0);
      const upper = projected + 1.5 * regression.residualStdDev;
      forecast.push({
        date: projectedDate.toISOString().slice(0, 10),
        projected,
        lower,
        upper,
      });
    }

    const sumRange = (range: { amount: number }[]) =>
      range.reduce((acc, item) => acc + item.amount, 0);
    const lastSeven = lookbackRange.slice(-7);
    const previousSeven = lookbackRange.slice(-14, -7);
    const lastThirty = lookbackRange.slice(-30);
    const previousThirty = lookbackRange.slice(-60, -30);

    const lastSevenTotal = sumRange(lastSeven);
    const previousSevenTotal = sumRange(previousSeven);
    const lastThirtyTotal = sumRange(lastThirty);
    const previousThirtyTotal = sumRange(previousThirty);

    const weekOverWeek =
      previousSevenTotal === 0
        ? lastSevenTotal > 0
          ? 1
          : 0
        : (lastSevenTotal - previousSevenTotal) / previousSevenTotal;
    const monthOverMonth =
      previousThirtyTotal === 0
        ? lastThirtyTotal > 0
          ? 1
          : 0
        : (lastThirtyTotal - previousThirtyTotal) / previousThirtyTotal;
    const volatility =
      regression.residualStdDev === 0
        ? 0
        : regression.residualStdDev /
          Math.max(sumRange(lookbackRange) / Math.max(lookbackRange.length, 1), 1);
    const trendScore = clamp(
      (weekOverWeek * 0.6 + monthOverMonth * 0.4) * 100 - volatility * 25,
      -100,
      100
    );

    let ikiminaQuery = supabase
      .schema("app")
      .from("ikimina")
      .select("id, sacco_id, name, code, settings_json");
    if (saccoIds?.length) {
      ikiminaQuery = ikiminaQuery.in("sacco_id", saccoIds);
    }

    const { data: ikiminaRows, error: ikiminaError } = await ikiminaQuery;
    if (ikiminaError) {
      throw ikiminaError;
    }

    const { data: saccoRows } = await supabase.from("saccos").select("id, name");

    const saccoMap = new Map(
      (saccoRows ?? []).map((row) => [row.id, row.name] as [string, string])
    );

    let membersQuery = supabase.from("ikimina_members").select("ikimina_id").eq("status", "ACTIVE");
    if (saccoIds?.length) {
      membersQuery = membersQuery.in(
        "ikimina_id",
        (ikiminaRows ?? []).map((row) => row.id)
      );
    }
    const { data: memberRows } = await membersQuery;

    const memberCounts = new Map<string, number>();
    for (const member of memberRows ?? []) {
      const ikiminaId = (member as { ikimina_id: string }).ikimina_id;
      memberCounts.set(ikiminaId, (memberCounts.get(ikiminaId) ?? 0) + 1);
    }

    const riskInsights = (ikiminaRows ?? [])
      .map((ikimina) => {
        const members = memberCounts.get(ikimina.id) ?? 0;
        const risk = riskMap.get(ikimina.id) ?? { total: 0, last: null, trailingThirty: 0 };
        const { fixedAmount, frequency } = parseContributionSettings(ikimina.settings_json);
        const multiplier = frequencyMultiplier[frequency] ?? 1;
        const expected =
          fixedAmount && members > 0 ? fixedAmount * members * multiplier : risk.trailingThirty;
        const ratio = expected === 0 ? 1 : risk.trailingThirty / expected;
        const level = determineRiskLevel(ratio, risk.last ?? null);
        return {
          ikiminaId: ikimina.id,
          name: ikimina.name,
          code: ikimina.code,
          saccoName: saccoMap.get(ikimina.sacco_id) ?? null,
          members,
          trailingThirty: risk.trailingThirty,
          expectedThirty: expected,
          contributionRatio: ratio,
          lastContribution: risk.last ? risk.last.toISOString() : null,
          riskLevel: level,
        };
      })
      .filter((item) => item.members > 0)
      .sort((a, b) => {
        const levelOrder: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        if (levelOrder[a.riskLevel] === levelOrder[b.riskLevel]) {
          return a.contributionRatio - b.contributionRatio;
        }
        return levelOrder[a.riskLevel] - levelOrder[b.riskLevel];
      })
      .slice(0, 12);

    let smsQuery = supabase
      .from("sms_inbox")
      .select("status, received_at")
      .in("status", ["NEW", "FAILED", "PARSED", "PROCESSING", "QUEUED"]);
    if (saccoIds?.length) {
      smsQuery = smsQuery.in("sacco_id", saccoIds);
    }
    const { data: smsRows } = await smsQuery;

    const nowTime = Date.now();
    let backlog = 0;
    let failed = 0;
    let queued = 0;
    let lastReceivedAt: string | null = null;
    let totalDelay = 0;

    for (const sms of smsRows ?? []) {
      const receivedAt = new Date(sms.received_at);
      if (!lastReceivedAt || receivedAt > new Date(lastReceivedAt)) {
        lastReceivedAt = receivedAt.toISOString();
      }
      const status = sms.status ?? "";
      if (["NEW", "PROCESSING", "PARSED", "QUEUED"].includes(status)) {
        backlog += 1;
        totalDelay += (nowTime - receivedAt.getTime()) / (1000 * 60);
      }
      if (status === "FAILED") {
        failed += 1;
      }
      if (status === "QUEUED" || status === "PROCESSING") {
        queued += 1;
      }
    }

    const modemStatus = (() => {
      if (!lastReceivedAt) return "OFFLINE";
      const deltaMinutes = (nowTime - new Date(lastReceivedAt).getTime()) / (1000 * 60);
      if (deltaMinutes <= 10) return "ONLINE";
      if (deltaMinutes <= 60) return "DEGRADED";
      return "OFFLINE";
    })();

    let notificationsQuery = supabase
      .from("notification_queue")
      .select("scheduled_for")
      .eq("status", "PENDING")
      .order("scheduled_for", { ascending: true });
    if (saccoIds?.length) {
      notificationsQuery = notificationsQuery.in("event", [
        "RECON_ESCALATION",
        "SMS_RETRY",
        "DAILY_REPORT",
      ]);
    }
    const { data: notificationRows } = await notificationsQuery;

    const pendingNotifications = notificationRows?.length ?? 0;
    const nextScheduled = notificationRows?.[0]?.scheduled_for ?? null;

    const response = {
      horizonDays,
      historical: lookbackRange,
      forecast,
      growth: {
        weekOverWeek,
        monthOverMonth,
        trendScore,
        volatility,
      },
      risk: riskInsights,
      ingestionHealth: {
        backlog,
        failed,
        queued,
        lastReceivedAt,
        modemStatus,
        averageDelayMinutes: backlog > 0 ? totalDelay / backlog : 0,
      },
      automation: {
        pendingNotifications,
        nextScheduled,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analytics-forecast error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
