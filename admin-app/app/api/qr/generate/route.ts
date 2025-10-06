import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const requestSchema = z.object({
  stationId: z.string().uuid(),
  tableLabels: z.array(z.string().min(1)).min(1),
  batchCount: z.number().int().min(1).max(50)
});

function generateToken() {
  return `QR-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to generate QR tokens.'
      },
      { status: 503 }
    );
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.'
      },
      { status: 400 }
    );
  }

  // Verify station exists
  const { data: station, error: stationError } = await adminClient
    .from('stations')
    .select('id, name')
    .eq('id', payload.stationId)
    .maybeSingle();

  if (stationError || !station) {
    return NextResponse.json(
      { error: 'station_not_found', message: 'Station not found.' },
      { status: 404 }
    );
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
    return NextResponse.json(
      { error: 'qr_generate_failed', message: 'Unable to generate QR tokens.' },
      { status: 500 }
    );
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

  await recordAudit({
    actorId: headers().get('x-actor-id'),
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

  return NextResponse.json(
    {
      tokens: responseTokens,
      integration: {
        status: "ok" as const,
        target: "qr_generate"
      }
    },
    { status: 201 }
  );
}
