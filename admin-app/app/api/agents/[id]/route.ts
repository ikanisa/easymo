import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z
    .string()
    .optional()
    .transform((value) => value?.trim())
    .refine((value) => !value || /^[a-z0-9-]+$/.test(value), {
      message: "Slug may only contain lowercase letters, numbers, and hyphens",
    }),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  metadata: z.record(z.any()).optional(),
});

function slugify(source: string): string {
  return source
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const personaPromise = supabase
    .from("agent_personas")
    .select("id,name,slug,description,status,metadata,created_at,updated_at")
    .eq("id", params.id)
    .maybeSingle();

  const versionsPromise = supabase
    .from("agent_versions")
    .select("id,version_no,instructions,tools,memory_config,evaluation_plan,created_at,updated_at,created_by")
    .eq("persona_id", params.id)
    .order("version_no", { ascending: false });

  const promptsPromise = supabase
    .from("agent_prompts")
    .select("id,role,label,content,sort_order,created_at")
    .eq("persona_id", params.id)
    .order("sort_order", { ascending: true });

  const documentsPromise = supabase
    .from("agent_documents")
    .select("id,title,storage_path,checksum,metadata,created_at")
    .eq("persona_id", params.id)
    .order("created_at", { ascending: false });

  const deploymentsPromise = supabase
    .from("agent_deployments")
    .select("id,environment,status,notes,created_at,created_by,version_id")
    .eq("persona_id", params.id)
    .order("created_at", { ascending: false });

  const auditPromise = supabase
    .from("agent_audit_log")
    .select("id,action,payload,actor,created_at")
    .eq("persona_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const [personaRes, versionsRes, promptsRes, documentsRes, deploymentsRes, auditRes] =
    await Promise.all([personaPromise, versionsPromise, promptsPromise, documentsPromise, deploymentsPromise, auditPromise]);

  if (personaRes.error) {
    return NextResponse.json({ error: personaRes.error.message }, { status: 500 });
  }

  if (!personaRes.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    persona: personaRes.data,
    versions: versionsRes.data ?? [],
    prompts: promptsRes.data ?? [],
    documents: documentsRes.data ?? [],
    deployments: deploymentsRes.data ?? [],
    audit: auditRes.data ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    const json = await req.json();
    payload = updateSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  if (payload.name) {
    fields.name = payload.name.trim();
  }
  if (payload.slug) {
    fields.slug = payload.slug || slugify(payload.name ?? "");
  }
  if (payload.description !== undefined) {
    fields.description = payload.description;
  }
  if (payload.status) {
    fields.status = payload.status;
  }
  if (payload.metadata !== undefined) {
    fields.metadata = payload.metadata;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  fields.updated_at = new Date().toISOString();
  fields.updated_by = req.headers.get("x-actor-id") ?? null;

  const { data, error } = await supabase
    .from("agent_personas")
    .update(fields)
    .eq("id", params.id)
    .select("id,name,slug,description,status,metadata,created_at,updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ persona: data });
}
