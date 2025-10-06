import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { requireActorId } from '@/lib/server/auth';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  saccoId: z.string().uuid().optional().nullable(),
  quorum: z.object({
    threshold: z.number().int().min(1).max(10).nullable().optional(),
    roles: z.array(z.string().min(1)).optional(),
  }).optional(),
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
        message: 'Supabase credentials missing. Unable to update Ikimina.',
      },
      { status: 503 },
    );
  }

  const ikiminaId = params.id;
  if (!ikiminaId) {
    return NextResponse.json(
      { error: 'missing_id', message: 'Ikimina id is required.' },
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

  const { quorum: quorumUpdate, ...modelUpdates } = payload;

  if (!Object.keys(modelUpdates).length && quorumUpdate === undefined) {
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
    ...(modelUpdates.name !== undefined ? { name: modelUpdates.name } : {}),
    ...(modelUpdates.description !== undefined ? { description: modelUpdates.description } : {}),
    ...(modelUpdates.status !== undefined ? { status: modelUpdates.status } : {}),
    ...(modelUpdates.saccoId !== undefined ? { sacco_id: modelUpdates.saccoId } : {}),
  };

  let data;
  let error;
  if (Object.keys(updateBody).length) {
    ({ data, error } = await adminClient
      .from('ibimina')
      .update(updateBody)
      .eq('id', ikiminaId)
      .select('id, name, description, slug, status, created_at, sacco_id')
      .single());
  } else {
    ({ data, error } = await adminClient
      .from('ibimina')
      .select('id, name, description, slug, status, created_at, sacco_id')
      .eq('id', ikiminaId)
      .single());
  }

  if (error || !data) {
    logStructured({
      event: 'ibimina_update_failed',
      target: 'ibimina',
      status: 'error',
      message: error?.message ?? 'Unknown error',
      details: { ikiminaId },
    });
    return NextResponse.json(
      {
        error: 'ibimina_update_failed',
        message: 'Unable to update Ikimina.',
      },
      { status: error?.code === 'PGRST116' ? 404 : 500 },
    );
  }

  const auditDiff: Record<string, unknown> = { ...updateBody };

  if (quorumUpdate !== undefined) {
    const normalizedRoles = Array.isArray(quorumUpdate?.roles)
      ? quorumUpdate.roles.filter((role) => typeof role === 'string' && role.trim().length > 0).map((role) => role.trim())
      : [];
    const thresholdValue = quorumUpdate?.threshold ?? null;
    const quorumPayload = {
      threshold: thresholdValue != null && Number.isFinite(thresholdValue) ? thresholdValue : null,
      roles: normalizedRoles,
    };
    const { error: quorumError } = await adminClient
      .from('ibimina_settings')
      .upsert({
        ikimina_id: ikiminaId,
        quorum: quorumPayload,
      }, { onConflict: 'ikimina_id' });

    if (quorumError) {
      logStructured({
        event: 'ibimina_quorum_update_failed',
        target: 'ibimina_settings',
        status: 'error',
        message: quorumError.message,
        details: { ikiminaId },
      });
      return NextResponse.json(
        {
          error: 'ibimina_quorum_update_failed',
          message: 'Unable to update Ikimina quorum settings.',
        },
        { status: 500 },
      );
    }
    auditDiff.quorum = quorumPayload;
  }

  await recordAudit({
    actorId,
    action: 'ibimina_update',
    targetTable: 'ibimina',
    targetId: ikiminaId,
    diff: auditDiff,
  });

  return NextResponse.json({
    id: data.id,
    name: data.name,
    description: data.description,
    slug: data.slug,
    status: data.status,
    createdAt: data.created_at,
    saccoId: data.sacco_id,
  });
}
