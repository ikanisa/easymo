export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const pointSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

const createSchema = z
  .object({
    userId: z.string().uuid(),
    pickup: pointSchema,
    dropoff: pointSchema.optional(),
    status: z.string().optional(),
  })
  .passthrough();

function toGeography(point?: z.infer<typeof pointSchema> | null) {
  if (!point) return null;
  return `SRID=4326;POINT(${point.lng} ${point.lat})`;
}

export const POST = createHandler('rides_requests.create', async (request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to create ride request.',
      },
      { status: 503 },
    );
  }

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const { userId, pickup, dropoff, status, ...rest } = payload;
  for (const key of Object.keys(rest)) {
    if (rest[key] === undefined) {
      delete rest[key];
    }
  }

  const insertPayload = {
    ...rest,
    user_id: userId,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    pickup_geog: toGeography(pickup),
    dropoff_lat: dropoff ? dropoff.lat : null,
    dropoff_lng: dropoff ? dropoff.lng : null,
    dropoff_geog: toGeography(dropoff ?? null),
    status: status ?? 'live',
  } as Record<string, unknown>;

  const { data, error } = await adminClient
    .from('rides_requests')
    .insert(insertPayload)
    .select('id, user_id, status, pickup_geog, dropoff_geog, created_at')
    .single();

  if (error || !data) {
    logStructured({
      event: 'rides_request_create_failed',
      status: 'error',
      message: error?.message ?? 'Unknown error',
    });
    return NextResponse.json(
      {
        error: 'rides_request_create_failed',
        message: 'Unable to create ride request.',
      },
      { status: 500 },
    );
  }

  logStructured({
    event: 'rides_request_created',
    status: 'ok',
    details: { id: data.id, user_id: data.user_id },
  });

  return NextResponse.json(
    {
      id: data.id,
      userId: data.user_id,
      status: data.status,
      pickupGeog: data.pickup_geog,
      dropoffGeog: data.dropoff_geog,
      createdAt: data.created_at,
    },
    { status: 201 },
  );
});
