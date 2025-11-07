import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type AgentRow = {
  id: string;
  name: string;
  summary: string | null;
  status: string;
  default_language: string | null;
  tags: string[] | null;
  updated_at: string;
  created_at: string;
};

type SummaryRow = {
  agent_id: string;
  total_docs: number;
  ready_docs: number;
  json_chunks: number;
  vec_chunks: number;
};

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const [{ data: personas, error }, summaryRes] = await Promise.all([
    admin.from("agent_personas").select("*").order("updated_at", { ascending: false }),
    admin.rpc("agent_vectors_summary"),
  ]);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const summaries = new Map(
    (summaryRes.data as SummaryRow[] | null)?.map((row) => [row.agent_id, row]) ?? [],
  );

  const agents = (personas as AgentRow[] | null)?.map((agent) => {
    const summary = summaries.get(agent.id);
    const vectorStats = summary
      ? {
          totalDocs: summary.total_docs ?? 0,
          readyDocs: summary.ready_docs ?? 0,
          jsonChunks: summary.json_chunks ?? 0,
          vecChunks: summary.vec_chunks ?? 0,
        }
      : {
          totalDocs: 0,
          readyDocs: 0,
          jsonChunks: 0,
          vecChunks: 0,
        };
    return {
      ...agent,
      vector_stats: vectorStats,
    };
  }) ?? [];

  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const { name, summary, default_language = "en", tags = [] } = body || {};
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const { data, error } = await admin
    .from("agent_personas")
    .insert({ name, summary, default_language, tags })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ agent: data }, { status: 201 });
}

export const runtime = "nodejs";
