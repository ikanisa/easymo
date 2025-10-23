import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    let q = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

