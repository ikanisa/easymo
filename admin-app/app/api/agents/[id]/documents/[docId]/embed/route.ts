import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function POST(_: Request, { params }: { params: { id: string; docId: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  try {
    const { data, error } = await admin.functions.invoke('agent-doc-embed', { body: { document_id: params.docId } });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


export const runtime = "edge";
