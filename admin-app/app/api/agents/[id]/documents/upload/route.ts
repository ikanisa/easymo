import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, {
      status: 503,
    });
  }
  const { id } = params;
  const form = await req.formData();
  const file = form.get("file");
  const title = (form.get("title") as string) || undefined;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = file.name?.replace(/[^a-zA-Z0-9_.-]/g, "_") ||
    `upload_${Date.now()}`;
  const storagePath = `${id}/${Date.now()}_${safeName}`;
  const { error: upErr } = await admin.storage.from("agent-docs").upload(
    storagePath,
    bytes,
    {
      contentType: file.type || "application/octet-stream",
    },
  );
  if (upErr) return NextResponse.json({ error: upErr }, { status: 400 });
  const { data, error } = await admin.from("agent_documents").insert({
    agent_id: id,
    title: title || safeName,
    storage_path: storagePath,
    metadata: { size: file.size, type: file.type || null },
    embedding_status: "pending",
  }).select().single();
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ document: data }, { status: 201 });
}

export const runtime = "nodejs";
