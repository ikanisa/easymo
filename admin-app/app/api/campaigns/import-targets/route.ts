import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import Papa from 'papaparse';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { recordAudit } from '@/lib/server/audit';

const requestSchema = z.object({
  campaignId: z.string().uuid(),
  csv: z.string().min(1)
});

function csvToTargets(csv: string) {
  const parseResult = Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parseResult.errors.length) {
    throw new Error(parseResult.errors[0]?.message ?? 'CSV parse error');
  }
  const rows = parseResult.data as Record<string, string>[];
  const targets = rows
    .map((row) => ({
      msisdn: row.msisdn?.trim(),
      userId: row.user_id?.trim(),
      vars: Object.fromEntries(
        Object.entries(row).filter(([key]) => !['msisdn', 'user_id'].includes(key))
      )
    }))
    .filter((row) => row.msisdn);
  return targets;
}

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to import campaign targets.'
      },
      { status: 503 }
    );
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_payload', message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  let targets: { msisdn: string; userId?: string; vars: Record<string, unknown> }[];
  try {
    targets = csvToTargets(payload.csv);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'csv_parse_failed',
        message: error instanceof Error ? error.message : 'Failed to parse CSV.'
      },
      { status: 400 }
    );
  }

  if (!targets.length) {
    return NextResponse.json(
      { error: 'empty_targets', message: 'No valid targets found in CSV.' },
      { status: 400 }
    );
  }

  const actorId = headers().get('x-actor-id');

  const { error } = await adminClient.from('campaign_targets').upsert(
    targets.map((target) => ({
      campaign_id: payload.campaignId,
      msisdn: target.msisdn,
      user_id: target.userId ?? null,
      personalized_vars: target.vars,
      status: 'queued'
    }))
  );

  if (error) {
    logStructured({
      event: 'campaign_import_targets_failed',
      target: 'campaign_targets',
      status: 'error',
      message: error.message
    });
    return NextResponse.json(
      {
        error: 'campaign_import_failed',
        message: 'Unable to import campaign targets.'
      },
      { status: 500 }
    );
  }

  await recordAudit({
    actorId,
    action: 'campaign_import_targets',
    targetTable: 'campaign_targets',
    targetId: payload.campaignId,
    diff: { count: targets.length }
  });

  logStructured({
    event: 'campaign_import_targets',
    target: 'campaign_targets',
    status: 'ok',
    details: { campaignId: payload.campaignId, count: targets.length }
  });

  return NextResponse.json(
    {
      imported: targets.length
    },
    { status: 200 }
  );
}
