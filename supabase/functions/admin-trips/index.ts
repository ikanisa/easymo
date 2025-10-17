// Supabase Edge Function: admin-trips
//
// Lists or updates trips depending on the `action` parameter.  Supported
// actions:
//   - list (default, GET): return an array of trips ordered by created_at
//   - close (POST): mark a trip as closed/expired by id

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
    if (action === 'close' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const id = Number(body.id);
      if (!id) {
        return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
      }
      const { error } = await supabase
        .from('trips')
        .update({ status: 'expired' })
        .eq('id', id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    // Default: list trips
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ trips: data ?? [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});