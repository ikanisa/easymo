// Supabase Edge Function: admin-subscriptions
//
// Lists subscriptions or approves/rejects them based on the `action`
// query parameter.  Supported actions:
//   - list (default, GET): returns all subscriptions
//   - approve (POST): activate a subscription by id and optional txn_id
//   - reject (POST): reject a subscription by id with optional reason

import { serve } from 'https://deno.land/std@0.202.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN = Deno.env.get('EASYMO_ADMIN_TOKEN') ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase credentials are not configured');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'list';
  try {
    if (action === 'approve' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const id = Number(body.id);
      const txn_id = body.txn_id as string | undefined;
      if (!id) {
        return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
      }
      const updates: any = { status: 'active' };
      if (txn_id) updates.txn_id = txn_id;
      const { error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (action === 'reject' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const id = Number(body.id);
      const reason = body.reason as string | undefined;
      if (!id) {
        return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
      }
      const updates: any = { status: 'rejected' };
      if (reason) updates.rejection_reason = reason;
      const { error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    // Default: list subscriptions
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ subscriptions: data ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});