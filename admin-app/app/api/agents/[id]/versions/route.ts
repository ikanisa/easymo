import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const createVersionSchema = z.object({
  instructions: z.string().min(10, "Instructions too short"),
  tools: z.array(z.any()).optional().default([]),
  memory_config: z.record(z.any()).optional().default({}),
  evaluation_plan: z.array(z.any()).optional().default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  let payload: z.infer<typeof createVersionSchema>;
  try {
    const json = await req.json();
    payload = createVersionSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const actor = req.headers.get("x-actor-id") ?? null;

  const { data: persona, error: personaError } = await supabase
    .from("agent_personas")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  if (personaError) {
    return NextResponse.json({ error: personaError.message }, { status: 500 });
  }
  if (!persona) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: latest, error: versionError } = await supabase
    .from("agent_versions")
    .select("version_no")
    .eq("persona_id", params.id)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  const nextVersion = (latest?.version_no ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("agent_versions")
    .insert({
      persona_id: params.id,
      version_no: nextVersion,
      instructions: payload.instructions,
      tools: payload.tools ?? [],
      memory_config: payload.memory_config ?? {},
      evaluation_plan: payload.evaluation_plan ?? [],
      created_by: actor,
      updated_at: new Date().toISOString(),
    })
    .select("id,version_no,instructions,tools,memory_config,evaluation_plan,created_at,updated_at,created_by")
    .maybeSingle();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  if (inserted) {
    await supabase.from("agent_audit_log").insert({
      persona_id: params.id,
      actor,
      action: "version.created",
      payload: { version_no: inserted.version_no },
    });
  }

  return NextResponse.json({ version: inserted }, { status: 201 });
}
