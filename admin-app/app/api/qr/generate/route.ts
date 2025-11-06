export const dynamic = 'force-dynamic';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';
import { createHandler } from '@/app/api/withObservability';

const requestSchema = z.object({
  stationId: z.string().uuid(),
  tableLabels: z.array(z.string().min(1)).min(1),
  batchCount: z.number().int().min(1).max(50)
});

function generateToken() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return `QR-${hex.toUpperCase()}`;
}

export const POST = createHandler('admin_api.qr.generate', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to generate QR tokens.' }, 503);
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return zodValidationError(error);
  }

  // Verify station exists
  const { data: station, error: stationError } = await adminClient
    .from('stations')
    .select('id, name')
    .eq('id', payload.stationId)
    .maybeSingle();

  if (stationError || !station) {
    return jsonError({ error: 'station_not_found', message: 'Station not found.' }, 404);
  }

  const rows = [] as {
    station_id: string;
    table_label: string;
    token: string;
  }[];
  const responseTokens: {
    id: string;
    stationId: string;
    barName: string;
    tableLabel: string;
    token: string;
    createdAt: string;
    printed: boolean;
    lastScanAt: string | null;
  }[] = [];

  const createdAt = new Date().toISOString();

  for (let i = 0; i < payload.batchCount; i += 1) {
    for (const label of payload.tableLabels) {
      rows.push({
        station_id: payload.stationId,
        table_label: label,
        token: generateToken()
      });
    }
  }

  const { data, error } = await adminClient
    .from('qr_tokens')
    .insert(rows)
    .select('id, station_id, table_label, token, printed, created_at, last_scan_at');

  if (error || !data) {
    logStructured({
      event: 'qr_generate_failed',
      target: 'qr_tokens',
      status: 'error',
      message: error?.message ?? 'Insert failed',
      details: { stationId: payload.stationId }
    });
    return jsonError({ error: 'qr_generate_failed', message: 'Unable to generate QR tokens.' }, 500);
  }

  for (const row of data) {
    responseTokens.push({
      id: row.id,
      stationId: row.station_id,
      barName: station.name,
      tableLabel: row.table_label,
      token: row.token,
      createdAt: row.created_at ?? createdAt,
      printed: row.printed ?? false,
      lastScanAt: row.last_scan_at ?? null
    });
  }

  let actor: string | null = null;
  try {
    actor = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
  }

  await recordAudit({
    actorId: actor,
    action: 'qr_generate',
    targetTable: 'qr_tokens',
    targetId: station.id,
    diff: { count: responseTokens.length }
  });

  logStructured({
    event: 'qr_generate',
    target: 'qr_tokens',
    status: 'ok',
    details: {
      stationId: station.id,
      count: responseTokens.length
    }
  });

  return jsonOk({
    tokens: responseTokens,
    integration: { status: 'ok' as const, target: 'qr_generate' }
  }, 201);
});
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';

export const runtime = "edge";
