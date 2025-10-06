import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';

const KYC_STORAGE_BUCKET = process.env.KYC_STORAGE_BUCKET ?? 'kyc-documents';
const KYC_SIGNED_URL_TTL_SECONDS = (() => {
  const value = Number(process.env.KYC_SIGNED_URL_TTL_SECONDS ?? '86400');
  return Number.isFinite(value) && value > 0 ? value : 86400;
})();

const listQuerySchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'supabase_unavailable',
        message: 'Supabase credentials missing. Unable to fetch KYC documents.',
      },
      { status: 503 },
    );
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_query',
        message: error instanceof z.ZodError ? error.flatten() : 'Invalid query parameters.',
      },
      { status: 400 },
    );
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  const rangeEnd = offset + limit - 1;

  const supabaseQuery = adminClient
    .from('kyc_documents')
    .select(
      `id, user_id, doc_type, front_url, back_url, parsed_json, status, created_at, reviewed_at,
       profiles:user_id (display_name, msisdn)` ,
      { count: 'exact' },
    )
    .order('created_at', { ascending: true })
    .range(offset, rangeEnd);

  if (query.status) supabaseQuery.eq('status', query.status);
  if (query.search) {
    const term = `%${query.search}%`;
    supabaseQuery.or(`profiles.display_name.ilike.${term},profiles.msisdn.ilike.${term}`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'kyc_fetch_failed',
      target: 'kyc_documents',
      status: 'error',
      message: error.message,
    });
    return NextResponse.json(
      {
        error: 'kyc_fetch_failed',
        message: 'Unable to load KYC documents.',
      },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const enriched = await Promise.all(rows.map(async (row) => ({
    id: row.id,
    userId: row.user_id,
    docType: row.doc_type,
    frontUrl: await createSignedDocumentUrl(row.front_url),
    backUrl: await createSignedDocumentUrl(row.back_url),
    parsed: row.parsed_json ?? {},
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    profile: row.profiles ? {
      displayName: row.profiles.display_name ?? null,
      msisdn: row.profiles.msisdn ?? null,
    } : null,
  })));
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json(
    {
      data: enriched,
      total,
      hasMore,
    },
    { status: 200 },
  );
}

async function createSignedDocumentUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return null;
  const { data, error } = await adminClient.storage
    .from(KYC_STORAGE_BUCKET)
    .createSignedUrl(path, KYC_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    logStructured({
      event: 'kyc_signed_url_failed',
      target: 'kyc_documents',
      status: 'error',
      message: error?.message ?? 'Unable to sign KYC document path',
      details: { path },
    });
    return null;
  }
  return data.signedUrl;
}
