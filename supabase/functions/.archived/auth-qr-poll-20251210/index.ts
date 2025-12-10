// Supabase Edge Function: Poll QR Authentication Status from Web App
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      throw new Error('Missing session ID');
    }

    // Fetch session status
    const { data: session, error: sessionError } = await supabaseClient
      .from('auth_qr_sessions')
      .select('status, staff_id, web_access_token, web_refresh_token, token_expires_at, authenticated_at, expires_at')
      .eq('session_id', sessionId)
      .single();

    if (sessionError) {
      throw new Error('Session not found');
    }

    // Check if session expired
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date() && session.status === 'pending') {
      await supabaseClient
        .from('auth_qr_sessions')
        .update({ status: 'expired' })
        .eq('session_id', sessionId);
      
      return new Response(
        JSON.stringify({
          success: false,
          status: 'expired',
          message: 'Session expired',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    // If authenticated, return tokens and staff data
    if (session.status === 'authenticated') {
      // Fetch staff details
      const { data: staff, error: staffError } = await supabaseClient
        .from('staff')
        .select('id, email, full_name, role, status, avatar_url')
        .eq('id', session.staff_id)
        .single();

      if (staffError) {
        throw new Error('Failed to fetch staff data');
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'authenticated',
          data: {
            accessToken: session.web_access_token,
            refreshToken: session.web_refresh_token,
            expiresAt: session.token_expires_at,
            authenticatedAt: session.authenticated_at,
            user: {
              id: staff.id,
              email: staff.email,
              name: staff.full_name,
              role: staff.role,
              status: staff.status,
              avatarUrl: staff.avatar_url,
            },
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }

    // Still pending
    return new Response(
      JSON.stringify({
        success: true,
        status: session.status,
        message: 'Waiting for authentication',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('QR poll error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Poll failed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
