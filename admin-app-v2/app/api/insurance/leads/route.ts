import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServiceClient();
    
    // Query insurance_leads with related data
    const { data: leads, error } = await supabase
      .from('insurance_leads')
      .select(`
        id,
        whatsapp,
        status,
        file_path,
        extracted,
        created_at,
        updated_at,
        profiles:user_id (
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to fetch insurance leads:', error);
      return NextResponse.json({ 
        leads: [], 
        error: error.message 
      }, { status: 500 });
    }

    // Transform data to match expected format
    const transformedLeads = (leads || []).map((lead) => {
      // Extract vehicle info from OCR data if available
      const extracted = lead.extracted as Record<string, unknown> | null;
      const vehicleInfo = extracted?.make && extracted?.model 
        ? `${extracted.make} ${extracted.model} ${extracted.vehicle_year || ''}`.trim()
        : null;
      
      return {
        id: lead.id,
        customerName: lead.profiles?.full_name || lead.whatsapp || 'Unknown',
        whatsapp: lead.whatsapp,
        type: extracted?.insurance_type || 'motor', // default to motor if not specified
        status: lead.status || 'new',
        submittedAt: lead.created_at,
        details: vehicleInfo || (extracted?.insurer_name ? `Insurer: ${extracted.insurer_name}` : 'Pending review'),
        extracted: extracted,
      };
    });

    return NextResponse.json({ leads: transformedLeads });
  } catch (error) {
    console.error('Unexpected error fetching leads:', error);
    return NextResponse.json({ 
      leads: [], 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
