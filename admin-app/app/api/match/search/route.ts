export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { logStructured } from '@/lib/server/logger';
import { isFeatureEnabled } from '@/lib/server/feature-flags';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const requestSchema = z.object({
  actor_kind: z.enum(['driver', 'passenger']).transform((value) => value.toLowerCase() as 'driver' | 'passenger'),
  pickup: z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
  }),
  dropoff: z
    .object({
      lat: z.coerce.number(),
      lng: z.coerce.number(),
    })
    .optional(),
  radius_km: z.coerce.number().positive().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

type MatchRow = {
  kind: 'offer' | 'request';
  id: string;
  created_at: string;
  pickup_distance_km: number | null;
  dropoff_distance_km: number | null;
};

export const POST = createHandler('matching.dual_constraint_search', async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to execute match search.',
      },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const radiusKm = payload.radius_km ?? 10;
  const limit = payload.limit ?? 20;
  const hasDropoff = Boolean(payload.dropoff);
  const dualConstraintEnabled = hasDropoff && isFeatureEnabled('dualConstraintMatching.enabled', true);

  const rpcPayload = {
    actor_kind: payload.actor_kind,
    pickup_lat: payload.pickup.lat,
    pickup_lng: payload.pickup.lng,
    dropoff_lat: payload.dropoff?.lat ?? null,
    dropoff_lng: payload.dropoff?.lng ?? null,
    radius_km: radiusKm,
    limit_count: limit,
    require_dual: dualConstraintEnabled,
  };

  const rpcResult = await adminClient.rpc('match_search_candidates', rpcPayload);
  const data = rpcResult.data as MatchRow[] | null;
  const error = rpcResult.error;

  if (error) {
    logStructured({
      event: 'match_search_failed',
      status: 'error',
      message: error.message,
      details: { radiusKm, hasDropoff, actorKind: payload.actor_kind },
    });
    return NextResponse.json(
      {
        error: 'match_query_failed',
        message: 'Unable to load matching candidates.',
      },
      { status: 500 },
    );
  }

  const candidates = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    pickupDistanceKm: row.pickup_distance_km ?? null,
    dropoffDistanceKm: row.dropoff_distance_km ?? null,
    createdAt: row.created_at,
  }));

  logStructured({
    event: 'match_query_executed',
    status: 'ok',
    details: {
      radius_km: radiusKm,
      has_dropoff: hasDropoff,
      actor_kind: payload.actor_kind,
      candidate_count: candidates.length,
      dual_constraint_applied: dualConstraintEnabled,
    },
  });

  recordMetric('match.candidates.count', candidates.length, {
    radius_km: radiusKm,
    has_dropoff: hasDropoff,
    dual_constraint_applied: dualConstraintEnabled,
  });

  return NextResponse.json({
    data: candidates,
    meta: {
      radiusKm,
      hasDropoff,
      dualConstraintApplied: dualConstraintEnabled,
    },
  });
});
