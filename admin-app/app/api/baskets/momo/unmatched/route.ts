import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { logStructured } from '@/lib/server/logger';
import { jsonOk, jsonError, zodValidationError } from '@/lib/api/http';

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase credentials missing. Unable to fetch unmatched SMS.' }, 503);
  }

  let query: z.infer<typeof listQuerySchema>;
  try {
    query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  } catch (error) {
    return zodValidationError(error);
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  const rangeEnd = offset + limit - 1;

  const supabaseQuery = adminClient
    .from('momo_unmatched')
    .select(
      `id, reason, status, created_at,
       momo_parsed_txns:parsed_id (id, msisdn_e164, sender_name, amount, currency, txn_id, txn_ts)` ,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, rangeEnd);

  if (query.status) {
    supabaseQuery.eq('status', query.status);
  }

  if (query.search) {
    const term = `%${query.search}%`;
    supabaseQuery.or(`reason.ilike.${term},momo_parsed_txns.msisdn_e164.ilike.${term}`);
  }

  const { data, error, count } = await supabaseQuery;

  if (error) {
    logStructured({
      event: 'momo_unmatched_fetch_failed',
      target: 'momo_unmatched',
      status: 'error',
      message: error.message,
    });
    return jsonError({ error: 'momo_unmatched_fetch_failed', message: 'Unable to load unmatched SMS.' }, 500);
  }

  const rows = data ?? [];
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return jsonOk({
    data: rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      parsed: row.momo_parsed_txns ? {
        id: row.momo_parsed_txns.id,
        msisdnE164: row.momo_parsed_txns.msisdn_e164,
        senderName: row.momo_parsed_txns.sender_name,
        amount: row.momo_parsed_txns.amount,
        currency: row.momo_parsed_txns.currency,
        txnId: row.momo_parsed_txns.txn_id,
        txnTs: row.momo_parsed_txns.txn_ts,
      } : null,
    })),
    total,
    hasMore,
  });
}
