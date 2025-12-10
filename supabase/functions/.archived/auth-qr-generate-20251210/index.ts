// Supabase Edge Function: Generate QR Authentication Session
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QRAuthSession {
  session_id: string;
  challenge: string;
  expires_at: string;
  browser_fingerprint?: string;
  ip_address?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Generate secure session ID and challenge
    const sessionId = crypto.randomUUID();
    const challenge = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Get request metadata
    const browserFingerprint = req.headers.get('x-browser-fingerprint') || null;
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

    // Store session in database
    const { error: insertError } = await supabaseClient
      .from('auth_qr_sessions')
      .insert({
        session_id: sessionId,
        challenge: challenge,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        browser_fingerprint: browserFingerprint,
        ip_address: ipAddress,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(`Failed to create session: ${insertError.message}`);
    }

    // Generate QR code payload
    const qrPayload = {
      sessionId,
      challenge,
      expiresAt: expiresAt.toISOString(),
      type: 'staff-admin-auth',
      version: '1.0',
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          sessionId,
          qrPayload: btoa(JSON.stringify(qrPayload)),
          expiresAt: expiresAt.toISOString(),
          pollInterval: 2000, // Poll every 2 seconds
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('QR generation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate QR session',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
