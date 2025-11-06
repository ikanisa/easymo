export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { mockBars } from '@/lib/mock-data';
import { createHandler } from '@/app/api/withObservability';
import { jsonOk, zodValidationError } from '@/lib/api/http';

const querySchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

function selectMock(params: z.infer<typeof querySchema>) {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;
  const filtered = mockBars.filter((bar) => {
    const statusMatch = params.status
      ? bar.isActive === (params.status === 'active')
      : true;
    const searchMatch = params.search
      ? `${bar.name} ${bar.location ?? ''}`.toLowerCase().includes(params.search.toLowerCase())
      : true;
    return statusMatch && searchMatch;
  });
  const slice = filtered.slice(offset, offset + limit);
  return {
    data: slice,
    total: filtered.length,
    hasMore: offset + slice.length < filtered.length
  };
}

function fromMocks(params: z.infer<typeof querySchema>, message: string) {
  const result = selectMock(params);
  return jsonOk({
    ...result,
    integration: {
      status: 'degraded' as const,
      target: 'bars',
      message,
    },
  });
}

export const GET = createHandler('admin_api.bars.list', async (request, _context, { recordMetric }) => {
  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    recordMetric('bars.invalid_query', 1);
    return zodValidationError(error);
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('bars.supabase_unavailable', 1);
    return fromMocks(params, 'Supabase credentials missing. Showing mock bars.');
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  const supabaseQuery = adminClient
    .from('bars')
    .select(
      `id, slug, name, location_text, city_area, is_active, created_at, updated_at,
       default_prep_minutes, momo_code, service_charge, payment_instructions,
       published_menu_version,
       bar_numbers(count),
       bar_settings:bar_settings(allow_direct_customer_chat)` ,
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    supabaseQuery.eq('is_active', params.status === 'active');
  }
  if (params.search) {
    const pattern = `%${params.search}%`;
    supabaseQuery.or(`name.ilike.${pattern},location_text.ilike.${pattern}`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'bars_fetch_failed',
      target: 'bars',
      status: 'error',
      message: error.message
    });
    recordMetric('bars.supabase_error', 1, { message: error.message });
    return fromMocks(params, 'Supabase query failed. Showing mock bars.');
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  const payload = rows.map((row) => {
    const receivingNumbers = Array.isArray(row.bar_numbers)
      ? row.bar_numbers.reduce((acc: number, entry: { count?: number }) => acc + (entry?.count ?? 0), 0)
      : 0;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug ?? row.id,
      location: row.location_text ?? row.city_area ?? null,
      isActive: row.is_active ?? false,
      receivingNumbers,
      publishedMenuVersion: row.published_menu_version ?? null,
      lastUpdated: row.updated_at ?? row.created_at ?? new Date().toISOString(),
      createdAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
      momoCode: row.momo_code ?? null,
      serviceCharge: row.service_charge ?? null,
      directChatEnabled: Array.isArray((row as any).bar_settings)
        ? Boolean((row as any).bar_settings[0]?.allow_direct_customer_chat)
        : Boolean((row as any).bar_settings?.allow_direct_customer_chat),
      defaultPrepMinutes: row.default_prep_minutes ?? null,
      paymentInstructions: row.payment_instructions ?? null
    };
  });

  recordMetric('bars.success', 1, { total });

  return jsonOk({ data: payload, total, hasMore });
});

export const runtime = "edge";
