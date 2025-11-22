import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id, versionId } = await params;
  let env: "staging" | "production" =
    (process.env.AGENT_DEFAULT_DEPLOY_ENV === 'production' ? 'production' : 'staging');
  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object') {
      const envValue = (body as Record<string, unknown>)?.environment;
      if (envValue === 'staging' || envValue === 'production') {
        env = envValue;
      }
    }
  } catch { /* ignore invalid json */ }
  const { error } = await admin.rpc("publish_agent_version", { _agent_id: id, _version_id: versionId, _env: env });
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ published: true, environment: env });
}

export const runtime = "nodejs";
