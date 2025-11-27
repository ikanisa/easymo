export const dynamic = 'force-dynamic';
import { createHandler } from '@/app/api/withObservability';
import { jsonError,jsonOk } from '@/lib/api/http';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

export const GET = createHandler('admin_api.wallet.partners.stats', async () => {
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError({ error: 'supabase_unavailable' }, 503);

  try {
    // Fetch partner statistics from the view
    const { data, error } = await admin
      .from('token_partner_stats')
      .select('*')
      .order('total_tokens_received', { ascending: false });

    if (error) {
      console.error('Failed to fetch partner stats:', error);
      return jsonError({ error: 'query_failed', message: error.message }, 500);
    }

    return jsonOk({ data: data || [] });
  } catch (err) {
    console.error('Error fetching partner stats:', err);
    return jsonError({ error: 'internal_error' }, 500);
  }
});

export const runtime = 'nodejs';
