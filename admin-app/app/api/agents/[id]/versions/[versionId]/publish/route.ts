import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(_: Request, { params }: { params: { id: string; versionId: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id, versionId } = params;
  const env = (process.env.AGENT_DEFAULT_DEPLOY_ENV ?? "staging") as "staging" | "production";
  const { error } = await admin.rpc("publish_agent_version", { _agent_id: id, _version_id: versionId, _env: env });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ published: true, environment: env });
}

