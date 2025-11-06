import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  channel: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", details: parsed.error.flatten() }, { status: 400 });
  }

  const { channel, from, to } = parsed.data;

  const query = admin.from("voice_call_kpis")
    .select(
      "day, channel, total_calls, completed_calls, failed_calls, average_duration_seconds, p95_assistant_seconds",
    )
    .order("day", { ascending: true });

  if (channel) query.eq("channel", channel);
  if (from) query.gte("day", from);
  if (to) query.lte("day", to);

  const { data, error } = await query;
  if (error || !data) {
    return NextResponse.json({ error: "csv_generation_failed", details: error?.message }, { status: 500 });
  }

  const rows = [
    [
      "day",
      "channel",
      "total_calls",
      "completed_calls",
      "failed_calls",
      "average_duration_seconds",
      "p95_assistant_seconds",
    ],
    ...data.map((row) => [
      row.day,
      row.channel,
      row.total_calls,
      row.completed_calls,
      row.failed_calls,
      row.average_duration_seconds,
      row.p95_assistant_seconds,
    ]),
  ];

  const csv = rows.map((line) => line.map(formatCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=voice-analytics.csv",
    },
  });
}

function formatCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const runtime = "edge";
