import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const paramsSchema = z.object({ id: z.string().uuid() });

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  engencode: z.string().min(1).optional(),
  ownerContact: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'Provide at least one field to update.'
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json({ error: 'invalid_station_id' }, { status: 400 });
  }
  const stationId = parseParams.data.id;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'supabase_unavailable', message: 'Supabase credentials missing.' },
      { status: 503 }
    );
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.engencode !== undefined) updates.engencode = payload.engencode;
  if (payload.ownerContact !== undefined) updates.owner_contact = payload.ownerContact;
  if (payload.status !== undefined) updates.status = payload.status;

  const { data, error } = await adminClient
    .from('stations')
    .update(updates)
    .eq('id', stationId)
    .select('id, name, engencode, owner_contact, status, created_at')
    .maybeSingle();

  if (error || !data) {
    logStructured({
      event: 'station_update_failed',
      target: 'stations',
      status: 'error',
      message: error?.message ?? 'Station not found',
      details: { stationId }
    });
    return NextResponse.json(
      { error: 'station_update_failed', message: 'Unable to update station.' },
      { status: 500 }
    );
  }

  await recordAudit({
    actorId: headers().get('x-actor-id'),
    action: 'station_update',
    targetTable: 'stations',
    targetId: stationId,
    diff: updates
  });

  return NextResponse.json(
    {
      data: {
        id: data.id,
        name: data.name,
        engencode: data.engencode,
        ownerContact: data.owner_contact,
        status: data.status,
        createdAt: data.created_at
      }
    },
    { status: 200 }
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json({ error: 'invalid_station_id' }, { status: 400 });
  }
  const stationId = parseParams.data.id;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'supabase_unavailable', message: 'Supabase credentials missing.' },
      { status: 503 }
    );
  }

  const { error } = await adminClient
    .from('stations')
    .delete()
    .eq('id', stationId);

  if (error) {
    logStructured({
      event: 'station_delete_failed',
      target: 'stations',
      status: 'error',
      message: error.message,
      details: { stationId }
    });
    return NextResponse.json(
      { error: 'station_delete_failed', message: 'Unable to delete station.' },
      { status: 500 }
    );
  }

  await recordAudit({
    actorId: headers().get('x-actor-id'),
    action: 'station_delete',
    targetTable: 'stations',
    targetId: stationId,
    diff: {}
  });

  return NextResponse.json({ status: 'deleted' }, { status: 200 });
}
