import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { requireActorId } from '@/lib/server/auth';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  branchCode: z.string().min(1).optional(),
  umurengeName: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  ltvMinRatio: z.coerce.number().min(0.1).max(10).optional(),
});

type UpdatePayload = z.infer<typeof updateSchema>;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to update SACCO.',
      },
      { status: 503 },
    );
  }

  const saccoId = params.id;
  if (!saccoId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'SACCO id is required.' },
      { status: 400 },
    );
  }

  let payload: UpdatePayload;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json(
      {
        error: 'empty_update',
        message: 'Provide at least one field to update.',
      },
      { status: 400 },
    );
  }

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (error) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        message: error instanceof Error ? error.message : 'Unauthorized',
      },
      { status: 401 },
    );
  }

  const updateBody = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.branchCode !== undefined ? { branch_code: payload.branchCode } : {}),
    ...(payload.umurengeName !== undefined ? { umurenge_name: payload.umurengeName } : {}),
    ...(payload.district !== undefined ? { district: payload.district } : {}),
    ...(payload.contactPhone !== undefined ? { contact_phone: payload.contactPhone } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.ltvMinRatio !== undefined ? { ltv_min_ratio: payload.ltvMinRatio } : {}),
  };

  const { data, error } = await adminClient
    .from('saccos')
    .update(updateBody)
    .eq('id', saccoId)
    .select('id, name, branch_code, umurenge_name, district, contact_phone, status, created_at, ltv_min_ratio')
    .single();

  if (error || !data) {
    logStructured({
      event: 'saccos_update_failed',
      target: 'saccos',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { saccoId },
    });
    return NextResponse.json(
      {
        error: 'saccos_update_failed',
        message: 'Unable to update SACCO.',
      },
      { status: error?.code === 'PGRST116' ? 404 : 500 },
    );
  }

  await recordAudit({
    actorId,
    action: 'saccos_update',
    targetTable: 'saccos',
    targetId: saccoId,
    diff: updateBody,
  });

  return NextResponse.json({
    id: data.id,
    name: data.name,
    branchCode: data.branch_code,
    umurengeName: data.umurenge_name,
    district: data.district,
    contactPhone: data.contact_phone,
    status: data.status,
    createdAt: data.created_at,
    ltvMinRatio: Number(data.ltv_min_ratio ?? 1),
  });
}
