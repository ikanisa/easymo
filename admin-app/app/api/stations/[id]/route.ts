import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/lib/server/audit';
import { bridgeDegraded, bridgeHealthy, callBridge } from '@/lib/server/edge-bridges';

const paramsSchema = z.object({
  id: z.string().min(1)
});

const updateSchema = z.object({
  name: z.string().optional(),
  engencode: z.string().optional(),
  ownerContact: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const payload = updateSchema.parse(await request.json());
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');
    const adminClient = getSupabaseAdminClient();

    if (adminClient) {
      const { data, error } = await adminClient
        .from('stations')
        .update({
          name: payload.name,
          engencode: payload.engencode,
          owner_contact: payload.ownerContact,
          status: payload.status
        })
        .eq('id', id)
        .select('id, name, engencode, owner_contact, status, updated_at');

      if (!error && data?.[0]) {
        const bridgeResult = await callBridge('stationDirectory', {
          action: 'update',
          station: {
            id,
            name: data[0].name,
            engencode: data[0].engencode,
            ownerContact: data[0].owner_contact,
            status: data[0].status
          }
        });

        await recordAudit({
          actor: 'admin:mock',
          action: 'station_update',
          targetTable: 'stations',
          targetId: id,
          summary: 'Station updated'
        });

        return NextResponse.json(
          {
            station: data[0],
            integration: bridgeResult.ok
              ? bridgeHealthy('stationDirectory')
              : bridgeDegraded('stationDirectory', bridgeResult)
          },
          { status: 200 }
        );
      }

      console.error('Supabase station update failed', error);
    }

    const bridgeResult = await callBridge('stationDirectory', {
      action: 'update',
      station: {
        id,
        name: payload.name ?? undefined,
        engencode: payload.engencode ?? undefined,
        ownerContact: payload.ownerContact ?? null,
        status: payload.status ?? undefined
      }
    });

    await recordAudit({
      actor: 'admin:mock',
      action: 'station_update',
      targetTable: 'stations',
      targetId: id,
      summary: 'Station updated (mock)'
    });
    return NextResponse.json(
      {
        station: { id, ...payload, updated_at: new Date().toISOString() },
        integration: bridgeResult.ok
          ? bridgeHealthy('stationDirectory')
          : bridgeDegraded('stationDirectory', bridgeResult)
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to update station', error);
    return NextResponse.json({ error: 'station_update_failed' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const { id } = paramsSchema.parse(context.params);
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');
    const adminClient = getSupabaseAdminClient();

    if (adminClient) {
      const { error } = await adminClient.from('stations').delete().eq('id', id);
      if (error) {
        console.error('Supabase station delete failed', error);
      }
    }

    const bridgeResult = await callBridge('stationDirectory', {
      action: 'delete',
      station: { id }
    });

    await recordAudit({
      actor: 'admin:mock',
      action: 'station_delete',
      targetTable: 'stations',
      targetId: id,
      summary: 'Station deleted'
    });
    return NextResponse.json(
      {
        id,
        integration: bridgeResult.ok
          ? bridgeHealthy('stationDirectory')
          : bridgeDegraded('stationDirectory', bridgeResult)
      },
      { status: bridgeResult.ok || bridgeResult.reason === 'missing_endpoint' ? 200 : 502 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_params', details: error.flatten() }, { status: 400 });
    }
    console.error('Failed to delete station', error);
    return NextResponse.json({ error: 'station_delete_failed' }, { status: 500 });
  }
}
