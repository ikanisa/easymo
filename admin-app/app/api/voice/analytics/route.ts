import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  status: z.string().optional(),
  channel: z.string().optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parseResult.success) {
    return NextResponse.json({ error: "invalid_query", details: parseResult.error.flatten() }, { status: 400 });
  }

  const { status, channel, search, from, to } = parseResult.data;

  const callsQuery = admin.from("voice_calls")
    .select(
      "id, sip_session_id, lead_name, lead_phone, status, channel, started_at, ended_at, duration_seconds, last_note, first_time_to_assistant_seconds",
    )
    .order("started_at", { ascending: false })
    .limit(200);

  if (status) callsQuery.eq("status", status);
  if (channel) callsQuery.eq("channel", channel);
  if (from) callsQuery.gte("started_at", from);
  if (to) callsQuery.lte("started_at", to);
  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    callsQuery.or(`lead_name.ilike.${pattern},lead_phone.ilike.${pattern},last_note.ilike.${pattern}`);
  }

  const { data: calls, error: callsError } = await callsQuery;
  if (callsError) {
    return NextResponse.json({ error: "calls_fetch_failed", details: callsError.message }, { status: 500 });
  }

  const followupsQuery = admin.from("voice_followups")
    .select("id, call_id, scheduled_at, channel, status, notes")
    .order("scheduled_at", { ascending: false })
    .limit(100);

  const { data: followups, error: followupsError } = await followupsQuery;
  if (followupsError) {
    return NextResponse.json({ error: "followups_fetch_failed", details: followupsError.message }, { status: 500 });
  }

  const stats = await computeStats(admin, { status, channel, from, to });

  return NextResponse.json({
    calls: (calls ?? []).map((row) => ({
      id: row.id,
      waCallId: row.sip_session_id,
      leadName: row.lead_name,
      phone: row.lead_phone,
      status: row.status,
      channel: row.channel,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds,
      firstTimeToAssistantSeconds: row.first_time_to_assistant_seconds,
      lastNote: row.last_note,
    })),
    followups: (followups ?? []).map((row) => ({
      id: row.id,
      callId: row.call_id,
      scheduledAt: row.scheduled_at,
      channel: row.channel,
      status: row.status,
      notes: row.notes,
    })),
    stats,
  });
}

async function computeStats(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  filters: { status?: string; channel?: string; from?: string; to?: string },
) {
  const base = admin.from("voice_calls").select("status, duration_seconds, first_time_to_assistant_seconds");
  if (filters.status) base.eq("status", filters.status);
  if (filters.channel) base.eq("channel", filters.channel);
  if (filters.from) base.gte("started_at", filters.from);
  if (filters.to) base.lte("started_at", filters.to);

  const { data, error } = await base;
  if (error || !data) return null;

  const total = data.length;
  const completed = data.filter((item) => item.status === "completed").length;
  const failed = data.filter((item) => item.status === "failed").length;
  const duration = average(data.map((item) => item.duration_seconds));
  const firstAudio = percentile95(data.map((item) => item.first_time_to_assistant_seconds ?? null));

  return {
    totalCalls: total,
    completed,
    failed,
    averageDurationSeconds: duration,
    firstTimeToAssistantSeconds: firstAudio,
  };
}

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === "number" && value > 0);
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function percentile95(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => typeof value === "number" && value > 0);
  if (!filtered.length) return null;
  filtered.sort((a, b) => a - b);
  const index = Math.floor(0.95 * (filtered.length - 1));
  return filtered[index];
}

export const runtime = "nodejs";
