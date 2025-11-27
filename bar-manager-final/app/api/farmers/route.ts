export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

// GET /api/farmers - List all farms
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'supabase_unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const district = searchParams.get('district');
  const commodity = searchParams.get('commodity');

  let query = admin
    .from('farms')
    .select(`
      *,
      profiles:profile_id(user_id, whatsapp_e164, locale),
      farm_synonyms(phrase, locale)
    `, { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (district) {
    query = query.eq('district', district);
  }

  if (commodity) {
    query = query.contains('commodities', [commodity]);
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to fetch farms:', error);
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

// POST /api/farmers - Create new farm
export async function POST(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'supabase_unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json();
    
    const { data, error } = await admin
      .from('farms')
      .insert({
        profile_id: body.profile_id,
        farm_name: body.farm_name,
        district: body.district,
        sector: body.sector,
        region: body.region,
        hectares: body.hectares,
        commodities: body.commodities || [],
        certifications: body.certifications || [],
        irrigation: body.irrigation || false,
        cooperative_member: body.cooperative_member || false,
        cooperative_name: body.cooperative_name,
        phone_number: body.phone_number,
        whatsapp_e164: body.whatsapp_e164,
        metadata: body.metadata || {},
        status: body.status || 'active',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}

export const runtime = 'nodejs';
