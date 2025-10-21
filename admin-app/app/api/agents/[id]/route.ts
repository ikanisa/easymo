import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type AgentDocument = {
  id: string;
  title: string;
  created_at: string;
  source_url: string | null;
  storage_path: string | null;
  embedding_status: string | null;
  metadata?: Record<string, unknown> | null;
};

type KnowledgeStats = {
  total: number;
  ready: number;
  processing: number;
  pending: number;
  failed: number;
  other: number;
};

function summarizeDocuments(documents: AgentDocument[]): KnowledgeStats {
  return documents.reduce<KnowledgeStats>(
    (acc, doc) => {
      const status = (doc.embedding_status ?? "pending").toLowerCase();
      if (status in acc) {
        acc[status as keyof KnowledgeStats] += 1;
      } else {
        acc.other += 1;
      }
      acc.total += 1;
      return acc;
    },
    { total: 0, ready: 0, processing: 0, pending: 0, failed: 0, other: 0 },
  );
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });

  const { id } = params;

  const { data: agent, error: agentError } = await admin
    .from("agent_personas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (agentError) return NextResponse.json({ error: agentError }, { status: 400 });
  if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [versionsRes, documentsRes, deploymentsRes] = await Promise.all([
    admin
      .from("agent_versions")
      .select("*")
      .eq("agent_id", id)
      .order("version", { ascending: false }),
    admin
      .from("agent_documents")
      .select("id, title, created_at, source_url, storage_path, embedding_status, metadata")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("agent_deployments")
      .select("id, environment, status, version_id, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (versionsRes.error)
    return NextResponse.json({ error: versionsRes.error }, { status: 400 });
  if (documentsRes.error)
    return NextResponse.json({ error: documentsRes.error }, { status: 400 });
  if (deploymentsRes.error)
    return NextResponse.json({ error: deploymentsRes.error }, { status: 400 });

  const documents = (documentsRes.data ?? []) as AgentDocument[];
  const knowledgeStats = summarizeDocuments(documents);

  return NextResponse.json({
    agent,
    versions: versionsRes.data ?? [],
    documents,
    deployments: deploymentsRes.data ?? [],
    knowledgeStats,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const { name, summary, status, default_language, tags } = body || {};
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (typeof summary === "string") patch.summary = summary;
  if (typeof status === "string") patch.status = status;
  if (typeof default_language === "string") patch.default_language = default_language;
  if (Array.isArray(tags)) patch.tags = tags;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no_fields" }, { status: 400 });
  patch.updated_at = new Date().toISOString();
  const { data, error } = await admin.from("agent_personas").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ agent: data });
}

