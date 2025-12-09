import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/observability/logger";

const AUTH_GUEST_MODE = process.env.AUTH_GUEST_MODE === "1";
const AUTH_E2E_STUB = process.env.AUTH_E2E_STUB === "1";

interface SmsIngestStatusSummary {
  lastMessageAt: string | null;
  lastMessageStatus: string | null;
  lastFailureAt: string | null;
  lastFailureError: string | null;
  totalMessages: number;
  processedToday: number;
  failedToday: number;
  pendingMessages: number;
  ingestEventsTotal: number;
  ingestEventsLastAt: string | null;
}

interface SmsIngestStatusResponse {
  saccoId: string | null;
  summary: SmsIngestStatusSummary;
  generatedAt: string;
}

const STUB_RESPONSE: SmsIngestStatusResponse = {
  saccoId: "stub-sacco",
  generatedAt: new Date().toISOString(),
  summary: {
    lastMessageAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    lastMessageStatus: "PARSED",
    lastFailureAt: null,
    lastFailureError: null,
    totalMessages: 128,
    processedToday: 12,
    failedToday: 0,
    pendingMessages: 1,
    ingestEventsTotal: 982,
    ingestEventsLastAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
};

export async function GET() {
  if (AUTH_GUEST_MODE || AUTH_E2E_STUB) {
    return NextResponse.json(STUB_RESPONSE);
  }

  try {
    // Use createSupabaseServerClient to get a cookie-aware client
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("users")
      .select("sacco_id")
      .eq("id", user.id)
      .maybeSingle<{ sacco_id: string | null }>();

    if (profileError) {
      logError("sms_ingest.status.profile_failed", { error: profileError, userId: user.id });
      return NextResponse.json({ error: "Unable to load staff profile" }, { status: 500 });
    }

    const saccoId = profileRow?.sacco_id ?? null;

    const appClient = supabase.schema("app");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayIso = startOfDay.toISOString();

    let latestQuery = appClient
      .from("sms_inbox")
      .select("received_at, status, error")
      .order("received_at", { ascending: false })
      .limit(1);

    let failureQuery = appClient
      .from("sms_inbox")
      .select("received_at, error")
      .eq("status", "FAILED")
      .order("received_at", { ascending: false })
      .limit(1);

    let totalQuery = appClient.from("sms_inbox").select("id", { count: "exact", head: true });

    let todayQuery = appClient
      .from("sms_inbox")
      .select("id", { count: "exact", head: true })
      .gte("received_at", startOfDayIso);

    let failedTodayQuery = appClient
      .from("sms_inbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "FAILED")
      .gte("received_at", startOfDayIso);

    let pendingQuery = appClient
      .from("sms_inbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING");

    if (saccoId) {
      latestQuery = latestQuery.eq("sacco_id", saccoId);
      failureQuery = failureQuery.eq("sacco_id", saccoId);
      totalQuery = totalQuery.eq("sacco_id", saccoId);
      todayQuery = todayQuery.eq("sacco_id", saccoId);
      failedTodayQuery = failedTodayQuery.eq("sacco_id", saccoId);
      pendingQuery = pendingQuery.eq("sacco_id", saccoId);
    }

    const [
      latestResult,
      failureResult,
      totalResult,
      todayResult,
      failedTodayResult,
      pendingResult,
      ingestMetricResult,
    ] = await Promise.all([
      latestQuery.maybeSingle<{ received_at: string; status: string; error: string | null }>(),
      failureQuery.maybeSingle<{ received_at: string; error: string | null }>(),
      totalQuery,
      todayQuery,
      failedTodayQuery,
      pendingQuery,
      appClient
        .from("system_metrics")
        .select("total, last_occurred")
        .eq("event", "sms_ingested")
        .maybeSingle<{ total: number | null; last_occurred: string | null }>(),
    ]);

    if (latestResult.error) {
      throw latestResult.error;
    }
    if (failureResult.error) {
      throw failureResult.error;
    }
    if (totalResult.error) {
      throw totalResult.error;
    }
    if (todayResult.error) {
      throw todayResult.error;
    }
    if (failedTodayResult.error) {
      throw failedTodayResult.error;
    }
    if (pendingResult.error) {
      throw pendingResult.error;
    }
    if (ingestMetricResult.error) {
      throw ingestMetricResult.error;
    }

    const ingestTotal = ingestMetricResult.data?.total ?? 0;

    const summary: SmsIngestStatusSummary = {
      lastMessageAt: latestResult.data?.received_at ?? null,
      lastMessageStatus: latestResult.data?.status ?? null,
      lastFailureAt: failureResult.data?.received_at ?? null,
      lastFailureError: failureResult.data?.error ?? null,
      totalMessages: totalResult.count ?? 0,
      processedToday: todayResult.count ?? 0,
      failedToday: failedTodayResult.count ?? 0,
      pendingMessages: pendingResult.count ?? 0,
      ingestEventsTotal: Number.isFinite(ingestTotal) ? Number(ingestTotal) : 0,
      ingestEventsLastAt: ingestMetricResult.data?.last_occurred ?? null,
    };

    return NextResponse.json({
      saccoId,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logError("sms_ingest.status.unhandled", { error });
    return NextResponse.json({ error: "Failed to load SMS ingestion telemetry" }, { status: 500 });
  }
}
