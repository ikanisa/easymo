import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(_: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const { docId } = await context.params;
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  try {
    const { data, error } = await admin.functions.invoke('agent-doc-embed', { body: { document_id: docId } });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


export const runtime = "nodejs";
