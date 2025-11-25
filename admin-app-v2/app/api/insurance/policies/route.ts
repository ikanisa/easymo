import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServiceClient();
    
    // Query insurance_policies with profile data for holder name
    const { data: policies, error } = await supabase
      .from('insurance_policies')
      .select(`
        id,
        policy_number,
        insurer,
        status,
        valid_from,
        valid_until,
        tokens_allocated,
        created_at,
        updated_at,
        profiles:user_id (
          full_name,
          whatsapp
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to fetch insurance policies:', error);
      return NextResponse.json({ 
        policies: [], 
        error: error.message 
      }, { status: 500 });
    }

    // Transform data to match expected format
    const transformedPolicies = (policies || []).map((policy) => ({
      id: policy.id,
      policyNumber: policy.policy_number,
      holderName: policy.profiles?.full_name || 'Unknown',
      holderWhatsapp: policy.profiles?.whatsapp || null,
      insurer: policy.insurer,
      status: policy.status || 'pending',
      validFrom: policy.valid_from,
      validUntil: policy.valid_until,
      tokensAllocated: policy.tokens_allocated,
      createdAt: policy.created_at,
      updatedAt: policy.updated_at,
    }));

    return NextResponse.json({ policies: transformedPolicies });
  } catch (error) {
    console.error('Unexpected error fetching policies:', error);
    return NextResponse.json({ 
      policies: [], 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServiceClient();
    const data = await request.json();
    
    const { data: policy, error } = await supabase
      .from('insurance_policies')
      .insert({
        user_id: data.userId,
        policy_number: data.policyNumber,
        insurer: data.insurer,
        status: data.status || 'active',
        valid_from: data.validFrom || new Date().toISOString(),
        valid_until: data.validUntil,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create insurance policy:', error);
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating policy:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
