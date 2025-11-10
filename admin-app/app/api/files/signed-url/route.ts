export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { createHandler } from '@/app/api/withObservability';

const allowedBuckets = new Set(['operations', 'qr', 'campaign-media', 'docs']);

const requestSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1)
});

export const GET = createHandler('admin_api.files.signed_url', async (request: Request) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing.' }, 503);
  }

  const url = new URL(request.url);
  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse({
      bucket: url.searchParams.get('bucket'),
      path: url.searchParams.get('path')
    });
  } catch (error) {
    return zodValidationError(error);
  }

  if (!allowedBuckets.has(payload.bucket)) {
    return jsonError({ error: 'bucket_not_allowed', message: 'Bucket not in allowlist.' }, 403);
  }

  const { data, error } = await adminClient
    .storage
    .from(payload.bucket)
    .createSignedUrl(payload.path, 60);

  if (error || !data?.signedUrl) {
    logStructured({
      event: 'storage_signed_url_failed',
      target: 'storage',
      status: 'error',
      message: error?.message ?? 'Unable to generate signed URL.',
      details: { bucket: payload.bucket, path: payload.path }
    });
    return jsonError({ error: 'signed_url_failed', message: 'Unable to generate signed URL.' }, 500);
  }

  return jsonOk({ url: data.signedUrl, expiresIn: 60 });
});

export const runtime = "nodejs";
