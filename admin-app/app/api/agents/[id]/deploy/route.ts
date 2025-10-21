import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const ALLOWED_ENVIRONMENTS = new Set(["staging", "production"]);
const DEFAULT_ENVIRONMENT = "production";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });

  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const versionNumber = Number(body?.version);
  if (!Number.isInteger(versionNumber)) {
    return NextResponse.json({ error: "version_required" }, { status: 400 });
  }

  const rawEnvironment = typeof body?.environment === "string" ? body.environment.toLowerCase() : null;
  const environment = ALLOWED_ENVIRONMENTS.has(rawEnvironment ?? "")
    ? (rawEnvironment as "staging" | "production")
    : DEFAULT_ENVIRONMENT;

  const { data: versionRow, error: versionError } = await admin
    .from("agent_versions")
    .select("id")
    .eq("agent_id", id)
    .eq("version", versionNumber)
    .maybeSingle();

  if (versionError)
    return NextResponse.json({ error: versionError }, { status: 400 });
  if (!versionRow)
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });

  const rpcPayload = { _agent_id: id, _version_id: versionRow.id, _env: environment };
  const { error: publishError } = await admin.rpc("publish_agent_version", rpcPayload);

  if (publishError && publishError.code !== "42883") {
    return NextResponse.json({ error: publishError }, { status: 400 });
  }

  if (publishError && publishError.code === "42883") {
    const markPublished = await admin
      .from("agent_versions")
      .update({ published: true })
      .eq("id", versionRow.id);
    if (markPublished.error)
      return NextResponse.json({ error: markPublished.error }, { status: 400 });

    const upsertDeployment = await admin
      .from("agent_deployments")
      .upsert({
        agent_id: id,
        version_id: versionRow.id,
        environment,
        status: "active",
      });
    if (upsertDeployment.error)
      return NextResponse.json({ error: upsertDeployment.error }, { status: 400 });
  }

  const { error: statusError } = await admin
    .from("agent_personas")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (statusError)
    return NextResponse.json({ error: statusError }, { status: 400 });

  return NextResponse.json({
    deployed: true,
    environment,
    version: versionNumber,
    version_id: versionRow.id,
  });
}
