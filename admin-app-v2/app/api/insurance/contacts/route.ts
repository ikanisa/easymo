import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServiceClient();
    
    const { data: contacts, error } = await supabase
      .from('insurance_admin_contacts')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch insurance admin contacts:', error);
      return NextResponse.json({ 
        contacts: [], 
        error: error.message 
      }, { status: 500 });
    }

    // Transform data to match expected format
    const transformedContacts = (contacts || []).map((contact) => ({
      id: contact.id,
      name: contact.display_name,
      role: 'Insurance Support',
      phone: contact.contact_value,
      type: contact.contact_type,
      status: 'online', // Default to online for active contacts
    }));

    return NextResponse.json({ contacts: transformedContacts });
  } catch (error) {
    console.error('Unexpected error fetching contacts:', error);
    return NextResponse.json({ 
      contacts: [], 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServiceClient();
    const data = await request.json();
    
    // Get highest display order
    const { data: maxOrder } = await supabase
      .from('insurance_admin_contacts')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const nextOrder = (maxOrder?.display_order || 0) + 1;
    
    const { data: contact, error } = await supabase
      .from('insurance_admin_contacts')
      .insert({
        contact_type: data.type || 'whatsapp',
        contact_value: data.phone,
        display_name: data.name,
        display_order: nextOrder,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create insurance admin contact:', error);
      return NextResponse.json({ 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating contact:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
