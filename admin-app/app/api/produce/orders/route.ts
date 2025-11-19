export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

// GET /api/produce/orders - List all buyer orders
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'supabase_unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const marketCode = searchParams.get('market');
  const commodity = searchParams.get('commodity');

  let query = admin
    .from('farmer_orders')
    .select('*', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (marketCode) {
    query = query.eq('market_code', marketCode);
  }

  if (commodity) {
    query = query.eq('commodity', commodity);
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
    },
  });
}

export const runtime = 'nodejs';
