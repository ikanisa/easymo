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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { groupId, amount } = await req.json();

    if (!groupId || !amount || amount <= 0) {
      throw new Error('Invalid parameters');
    }

    // Check if user is a member of the group
    const { data: membership, error: memberError } = await supabase
      .from('group_members')
      .select('id, role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      throw new Error('You are not a member of this group');
    }

    // Start transaction - create contribution and update balances
    const { data: contribution, error: contributionError } = await supabase
      .from('group_contributions')
      .insert({
        group_id: groupId,
        user_id: user.id,
        amount,
        type: 'contribution',
        status: 'completed',
      })
      .select()
      .single();

    if (contributionError) {
      throw contributionError;
    }

    // Update member balance
    const { error: balanceError } = await supabase.rpc('increment_member_balance', {
      p_group_id: groupId,
      p_user_id: user.id,
      p_amount: amount,
    });

    if (balanceError) {
      throw balanceError;
    }

    // Update group total balance
    const { error: groupBalanceError } = await supabase.rpc('increment_group_balance', {
      p_group_id: groupId,
      p_amount: amount,
    });

    if (groupBalanceError) {
      throw groupBalanceError;
    }

    return new Response(
      JSON.stringify({ success: true, contribution }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Group contribution error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
