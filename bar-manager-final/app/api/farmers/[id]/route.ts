export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

// GET /api/farmers/[id] - Get farm details
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'supabase_unavailable' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('farms')
    .select(`
      *,
      profiles:profile_id(user_id, whatsapp_e164, locale, metadata),
      farm_synonyms(phrase, locale, category)
    `)
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/farmers/[id] - Update farm
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'supabase_unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json();
    
    const updateData: Record<string, unknown> = {};
    if (body.farm_name) updateData.farm_name = body.farm_name;
    if (body.district !== undefined) updateData.district = body.district;
    if (body.sector !== undefined) updateData.sector = body.sector;
    if (body.region !== undefined) updateData.region = body.region;
    if (body.hectares !== undefined) updateData.hectares = body.hectares;
    if (body.commodities !== undefined) updateData.commodities = body.commodities;
    if (body.certifications !== undefined) updateData.certifications = body.certifications;
    if (body.irrigation !== undefined) updateData.irrigation = body.irrigation;
    if (body.cooperative_member !== undefined) updateData.cooperative_member = body.cooperative_member;
    if (body.cooperative_name !== undefined) updateData.cooperative_name = body.cooperative_name;
    if (body.phone_number !== undefined) updateData.phone_number = body.phone_number;
    if (body.whatsapp_e164 !== undefined) updateData.whatsapp_e164 = body.whatsapp_e164;
    if (body.status) updateData.status = body.status;
    if (body.metadata) updateData.metadata = body.metadata;

    const { data, error } = await admin
      .from('farms')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}

// DELETE /api/farmers/[id] - Soft delete farm
export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'supabase_unavailable' }, { status: 503 });
  }

  const { error } = await admin
    .from('farms')
    .update({ status: 'inactive' })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
