import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

const allowedBuckets = new Set(['vouchers', 'qr', 'campaign-media', 'docs']);

const requestSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1)
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'supabase_unavailable', message: 'Supabase credentials missing.' },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse({
      bucket: url.searchParams.get('bucket'),
      path: url.searchParams.get('path')
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'invalid_query', message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.' },
      { status: 400 }
    );
  }

  if (!allowedBuckets.has(payload.bucket)) {
    return NextResponse.json(
      { error: 'bucket_not_allowed', message: 'Bucket not in allowlist.' },
      { status: 403 }
    );
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
    return NextResponse.json(
      { error: 'signed_url_failed', message: 'Unable to generate signed URL.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      url: data.signedUrl,
      expiresIn: 60
    },
    { status: 200 }
  );
}
