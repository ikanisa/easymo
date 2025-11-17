export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { createHandler } from '@/app/api/withObservability';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const querySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const GET = createHandler('admin_api.stations.list', async (request, _context, { recordMetric }) => {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    recordMetric('stations.supabase_unavailable', 1);
    return jsonOk({ data: [], total: 0, hasMore: false });
  }

  let params: z.infer<typeof querySchema>;
  try {
    params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const { search, status, limit = 200, offset = 0 } = params;

  const query = admin
    .from('stations')
    .select('id, name, code, whatsapp_e164, status, location_point, updated_at')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query.eq('status', status);
  if (search) {
    const pattern = `%${search}%`;
    query.or(`name.ilike.${pattern},code.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) {
    recordMetric('stations.supabase_error', 1, { message: error.message });
    return jsonError({ error: 'stations_fetch_failed', message: 'Unable to load stations.' }, 500);
  }

  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    engencode: row.code,
    ownerContact: row.whatsapp_e164 ?? null,
    status: row.status ?? 'active',
    location: (() => {
      const geo = row.location_point as any;
      if (!geo) return null;
      try {
        // Expect either GEOJSON or [lng, lat]
        if (Array.isArray(geo)) return { lat: Number(geo[1]), lng: Number(geo[0]) };
        if (typeof geo === 'object' && geo !== null) {
          const coords = (geo.coordinates ?? geo?.geometry?.coordinates) as any[] | undefined;
          if (Array.isArray(coords) && coords.length >= 2) return { lat: Number(coords[1]), lng: Number(coords[0]) };
        }
      } catch {}
      return null;
    })(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }));

  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;
  return jsonOk({ data: rows, total, hasMore });
});

export const runtime = 'nodejs';

