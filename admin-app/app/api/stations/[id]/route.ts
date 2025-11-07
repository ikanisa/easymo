export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
import { createHandler } from '@/app/api/withObservability';

const paramsSchema = z.object({ id: z.string().uuid() });

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  engencode: z.string().min(1).optional(),
  ownerContact: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional()
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'Provide at least one field to update.'
});

export const PATCH = createHandler('admin_api.stations.update', async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return jsonError({ error: 'invalid_station_id' }, 400);
  }
  const stationId = parseParams.data.id;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing.' }, 503);
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  let actorId: string;
  try {
    actorId = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
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
    return jsonError({ error: 'station_update_failed', message: 'Unable to update station.' }, 500);
  }

  await recordAudit({
    actorId,
    action: 'station_update',
    targetTable: 'stations',
    targetId: stationId,
    diff: updates
  });

  return jsonOk({
    data: {
      id: data.id,
      name: data.name,
      engencode: data.engencode,
      ownerContact: data.owner_contact,
      status: data.status,
      createdAt: data.created_at,
    },
  });
});

export const DELETE = createHandler('admin_api.stations.delete', async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return jsonError({ error: 'invalid_station_id' }, 400);
  }
  const stationId = parseParams.data.id;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing.' }, 503);
  }

  let actorIdDel: string;
  try {
    actorIdDel = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
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
    return jsonError({ error: 'station_delete_failed', message: 'Unable to delete station.' }, 500);
  }

  await recordAudit({
    actorId: actorIdDel,
    action: 'station_delete',
    targetTable: 'stations',
    targetId: stationId,
    diff: {}
  });

  return jsonOk({ status: 'deleted' });
});

export const runtime = "nodejs";
