import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const createPersonaSchema = z.object({
  name: z.string().min(2, "Name too short"),
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

export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("agent_personas")
    .select("id,name,slug,description,status,metadata,created_at,updated_at")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ personas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  let parsedBody: z.infer<typeof createPersonaSchema>;
  try {
    const json = await req.json();
    parsedBody = createPersonaSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const actor = req.headers.get("x-actor-id") ?? null;
  const name = parsedBody.name.trim();
  const slug = (parsedBody.slug ?? slugify(name)) || slugify(name);

  const { data, error } = await supabase
    .from("agent_personas")
    .insert({
      name,
      slug,
      description: parsedBody.description ?? null,
      status: parsedBody.status ?? "draft",
      metadata: parsedBody.metadata ?? {},
      created_by: actor,
      updated_by: actor,
      created_at: now,
      updated_at: now,
    })
    .select("id,name,slug,description,status,metadata,created_at,updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data) {
    await supabase.from("agent_audit_log").insert({
      persona_id: data.id,
      actor,
      action: "persona.created",
      payload: { name, slug, status: data.status },
    });
  }

  return NextResponse.json({ persona: data }, { status: 201 });
}
