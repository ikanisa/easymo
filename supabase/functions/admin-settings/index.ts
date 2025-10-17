// Supabase Edge Function: admin-settings
//
// Provides read and update operations on the `settings` table.  This
// function requires callers to supply an `x-api-key` header that matches
// the EASYMO_ADMIN_TOKEN environment variable.  Use a service role key
// for Supabase to bypass Row Level Security when updating settings.

import { serve } from 'https://deno.land/std@0.202.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0';
import { z } from 'https://esm.sh/zod@3.22.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN = Deno.env.get('EASYMO_ADMIN_TOKEN') ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase credentials are not configured');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Define a schema for settings updates.  Only allow defined fields.
const SettingsPatch = z.object({
  subscription_price: z.number().optional(),
  search_radius_km: z.number().optional(),
  max_results: z.number().optional(),
  momo_payee_number: z.string().optional(),
  support_phone_e164: z.string().optional(),
  admin_whatsapp_numbers: z.string().optional(),
});

serve(async (req) => {
  // Enforce admin token
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ config: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const result = SettingsPatch.safeParse(body);
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid payload', details: result.error.errors }), { status: 400 });
    }
    // Find the single settings row
    const { data: existing, error: fetchErr } = await supabase
      .from('settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Settings row does not exist' }), { status: 404 });
    }
    const { data: updated, error: updateErr } = await supabase
      .from('settings')
      .update(result.data)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ config: updated }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
});