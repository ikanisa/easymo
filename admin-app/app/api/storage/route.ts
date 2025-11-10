export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { mockStorageObjects } from '@/lib/mock-data';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { createHandler } from '@/app/api/withObservability';

const allowedBuckets = new Set(['operations', 'qr', 'campaign-media', 'docs']);

const querySchema = z.object({
  bucket: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

type StorageRow = {
  id: string;
  bucket: string;
  path: string;
  mimeType: string;
  sizeKb: number;
  updatedAt: string;
};

function filterAndPaginate(
  rows: StorageRow[],
  {
    bucket,
    search,
    limit,
    offset
  }: {
    bucket?: string;
    search?: string;
    limit: number;
    offset: number;
  }
) {
  const filtered = rows.filter((row) => {
    const bucketMatch = bucket ? row.bucket === bucket : true;
    const searchMatch = search
      ? row.path.toLowerCase().includes(search.toLowerCase())
      : true;
    return bucketMatch && searchMatch;
  });

  const total = filtered.length;
  const slice = filtered.slice(offset, offset + limit);
  const hasMore = offset + slice.length < total;

  return { data: slice, total, hasMore };
}

function fromMocks(
  params: z.infer<typeof querySchema>,
  limit: number,
  offset: number,
  options: { message?: string } = {}
) {
  const rows: StorageRow[] = mockStorageObjects.map((object: any) => ({
    id: object.id,
    bucket: object.bucket,
    path: object.path,
    mimeType: object.mimeType,
    sizeKb: object.sizeKb,
    updatedAt: object.updatedAt
  }));

  const result = filterAndPaginate(rows, {
    bucket: params.bucket,
    search: params.search,
    limit,
    offset
  });

  return jsonOk({
    ...result,
    integration: {
      status: 'degraded' as const,
      target: 'storage_browser',
      message: options.message ?? 'Supabase credentials missing. Showing mock storage objects.',
    },
  });
}

export const GET = createHandler('admin_api.storage.list', async (request: Request) => {
  const url = new URL(request.url);

  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(url.searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  if (params.bucket && !allowedBuckets.has(params.bucket)) {
    return jsonError({ error: 'bucket_not_allowed', message: 'Bucket not in allowlist.' }, 403);
  }

  const limit = params.limit ?? 200;
  const offset = params.offset ?? 0;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return fromMocks(params, limit, offset);
  }

  const buckets = params.bucket ? [params.bucket] : Array.from(allowedBuckets);
  const collected: StorageRow[] = [];
  let degradedMessage: string | null = null;
  let hadError = false;

  for (const bucket of buckets) {
    try {
      const { data, error } = await adminClient.storage.from(bucket).list('', {
        limit: Math.min(limit + offset, 1000),
        offset: 0
      });

      if (error) {
        hadError = true;
        degradedMessage = error.message;
        logStructured({
          event: 'storage_list_failed',
          target: 'storage',
          status: 'error',
          message: error.message,
          details: { bucket }
        });
        continue;
      }

      for (const item of data ?? []) {
        if (!item.id || !item.metadata) {
          continue; // skip folders
        }

        const updated = item.updated_at ?? item.created_at ?? new Date().toISOString();
        const sizeBytes = typeof item.metadata.size === 'number'
          ? item.metadata.size
          : Number(item.metadata.size ?? 0);

        collected.push({
          id: item.id ?? `${bucket}:${item.name}`,
          bucket,
          path: item.name,
          mimeType: item.metadata.mimetype ?? 'application/octet-stream',
          sizeKb: Number.isFinite(sizeBytes) ? Math.round(sizeBytes / 1024) : 0,
          updatedAt: updated
        });
      }
    } catch (error) {
      hadError = true;
      degradedMessage = error instanceof Error ? error.message : 'Unexpected storage error.';
      logStructured({
        event: 'storage_list_exception',
        target: 'storage',
        status: 'error',
        message: degradedMessage,
        details: { bucket }
      });
    }
  }

  if (!collected.length) {
    if (hadError) {
      return fromMocks(params, limit, offset, {
        message: degradedMessage ?? 'Supabase storage request failed. Showing mock data.'
      });
    }

    const body: Record<string, unknown> = {
      data: [],
      total: 0,
      hasMore: false
    };

    if (degradedMessage) {
      body.integration = {
        status: 'degraded' as const,
        target: 'storage_browser',
        message: degradedMessage
      };
    }

    return jsonOk(body);
  }

  collected.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const result = filterAndPaginate(collected, {
    bucket: params.bucket,
    search: params.search,
    limit,
    offset
  });

  const responseBody: Record<string, unknown> = {
    data: result.data,
    total: result.total,
    hasMore: result.hasMore
  };

  if (degradedMessage) {
    responseBody.integration = {
      status: 'degraded' as const,
      target: 'storage_browser',
      message: degradedMessage
    };
  }

  return jsonOk(responseBody);
});

export const runtime = "nodejs";
