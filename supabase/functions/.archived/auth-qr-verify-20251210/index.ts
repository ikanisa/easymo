// Supabase Edge Function: Verify QR Authentication from Mobile App
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyRequest {
  sessionId: string;
  challenge: string;
  staffId: string;
  deviceId: string;
  biometricVerified?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify staff JWT token from mobile app
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    const body: VerifyRequest = await req.json();
    const { sessionId, challenge, staffId, deviceId, biometricVerified } = body;

    // Verify staff ID matches token
    if (user.id !== staffId) {
      throw new Error('Staff ID mismatch');
    }

    // Fetch session from database
    const { data: session, error: sessionError } = await supabaseClient
      .from('auth_qr_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('challenge', challenge)
      .eq('status', 'pending')
      .single();

    if (sessionError || !session) {
      throw new Error('Invalid or expired session');
    }

    // Check if session expired
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      await supabaseClient
        .from('auth_qr_sessions')
        .update({ status: 'expired' })
        .eq('session_id', sessionId);
      
      throw new Error('Session expired');
    }

    // Verify device is registered and active
    const { data: device, error: deviceError } = await supabaseClient
      .from('staff_devices')
      .select('*')
      .eq('device_id', deviceId)
      .eq('staff_id', staffId)
      .eq('status', 'active')
      .single();

    if (deviceError || !device) {
      throw new Error('Device not registered or inactive');
    }

    // Generate access token for web session
    const webAccessToken = crypto.randomUUID();
    const webRefreshToken = crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create HMAC signature for additional security
    const hmacSecret = Deno.env.get('HMAC_SHARED_SECRET') ?? '';
    const hmac = createHmac('sha256', hmacSecret);
    hmac.update(`${sessionId}:${staffId}:${webAccessToken}`);
    const signature = hmac.digest('hex');

    // Update session with authentication data
    const { error: updateError } = await supabaseClient
      .from('auth_qr_sessions')
      .update({
        status: 'authenticated',
        staff_id: staffId,
        device_id: deviceId,
        web_access_token: webAccessToken,
        web_refresh_token: webRefreshToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        biometric_verified: biometricVerified || false,
        authenticated_at: new Date().toISOString(),
        signature: signature,
      })
      .eq('session_id', sessionId);

    if (updateError) {
      throw new Error('Failed to update session');
    }

    // Log authentication event
    await supabaseClient.from('auth_logs').insert({
      staff_id: staffId,
      event_type: 'qr_login',
      device_id: deviceId,
      session_id: sessionId,
      biometric_used: biometricVerified || false,
      ip_address: session.ip_address,
      browser_fingerprint: session.browser_fingerprint,
      created_at: new Date().toISOString(),
    });

    // Update device last used
    await supabaseClient
      .from('staff_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('device_id', deviceId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Authentication successful',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('QR verification error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Verification failed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
