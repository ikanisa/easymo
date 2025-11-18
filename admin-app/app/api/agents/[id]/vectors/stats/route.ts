import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { id } = await params;

  const { data, error } = await admin.rpc("agent_vectors_summary");
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  type SummaryRow = {
    agent_id: string;
    total_docs?: number | null;
    ready_docs?: number | null;
    json_chunks?: number | null;
    vec_chunks?: number | null;
  };

  const rows = (Array.isArray(data) ? (data as SummaryRow[]) : []);
  const summary = rows.find((row) => row.agent_id === id);

  if (summary) {
    return NextResponse.json({
      totalDocs: summary.total_docs ?? 0,
      readyDocs: summary.ready_docs ?? 0,
      jsonChunks: summary.json_chunks ?? 0,
      vecChunks: summary.vec_chunks ?? 0,
    });
  }

  return NextResponse.json({ totalDocs: 0, readyDocs: 0, jsonChunks: 0, vecChunks: 0 });
}

export const runtime = "nodejs";
