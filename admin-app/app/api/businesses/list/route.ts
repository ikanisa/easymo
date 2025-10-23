import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50)));
    const region = url.searchParams.get('region') ?? undefined;
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    let q = supabase.from('businesses').select('id,name,category,region,embedding').limit(limit);
    if (region) q = q.ilike('region', `%${region}%`);
    const { data, error } = await q as any;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

