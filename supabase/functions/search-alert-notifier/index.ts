import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchAlert {
  id: string;
  user_id: string;
  search_type: 'job' | 'property';
  search_criteria: Record<string, any>;
  last_notified_at: string | null;
  notification_frequency: 'instant' | 'daily' | 'weekly';
  whatsapp_users: {
    phone_number: string;
    first_name?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      processed: 0,
      notifications_sent: 0,
      errors: [] as string[],
    };

    // 1. Get all active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('search_alerts')
      .select('*, whatsapp_users(*)')
      .eq('is_active', true);

    if (alertsError) {
      throw new Error(`Failed to fetch alerts: ${alertsError.message}`);
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active alerts found', ...results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Process each alert
    for (const alert of alerts as SearchAlert[]) {
      try {
        results.processed++;

        // Check if it's time to notify
        const shouldNotify = checkNotificationTiming(
          alert.last_notified_at,
          alert.notification_frequency
        );

        if (!shouldNotify) {
          console.log(`Skipping alert ${alert.id} - not time yet`);
          continue;
        }

        // Search for new matches
        const newMatches = await searchNewMatches(
          supabase,
          alert.search_type,
          alert.search_criteria,
          alert.last_notified_at
        );

        if (newMatches.length === 0) {
          console.log(`No new matches for alert ${alert.id}`);
          // Still update last_notified_at to avoid checking too frequently
          await supabase
            .from('search_alerts')
            .update({ last_notified_at: new Date().toISOString() })
            .eq('id', alert.id);
          continue;
        }

        // Send WhatsApp notification
        await sendWhatsAppNotification(
          alert.whatsapp_users.phone_number,
          alert.whatsapp_users.first_name || 'there',
          alert.search_type,
          newMatches,
          alert.search_criteria
        );

        // Update last_notified_at
        await supabase
          .from('search_alerts')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', alert.id);

        results.notifications_sent++;
        console.log(`Sent notification for alert ${alert.id} with ${newMatches.length} matches`);

      } catch (e) {
        const errorMsg = `Alert ${alert.id}: ${e instanceof Error ? e.message : String(e)}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: 0,
        notifications_sent: 0,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function checkNotificationTiming(
  lastNotified: string | null,
  frequency: 'instant' | 'daily' | 'weekly'
): boolean {
  if (!lastNotified) return true;
  
  const now = new Date();
  const last = new Date(lastNotified);
  const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);

  switch (frequency) {
    case 'instant':
      return hoursSince >= 1; // Check every hour
    case 'daily':
      return hoursSince >= 24; // Check every 24 hours
    case 'weekly':
      return hoursSince >= 168; // Check every 7 days
    default:
      return false;
  }
}

async function searchNewMatches(
  supabase: any,
  type: 'job' | 'property',
  criteria: Record<string, any>,
  since: string | null
) {
  const table = type === 'job' ? 'job_listings' : 'property_listings';
  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  let query = supabase
    .from(table)
    .select('*')
    .gte('created_at', sinceDate)
    .eq('status', type === 'job' ? 'open' : 'available');

  // Apply filters from criteria
  if (criteria.location) {
    query = query.ilike('location', `%${criteria.location}%`);
  }

  if (criteria.query) {
    query = query.or(`title.ilike.%${criteria.query}%,description.ilike.%${criteria.query}%`);
  }

  if (type === 'job') {
    if (criteria.jobType && Array.isArray(criteria.jobType)) {
      query = query.in('job_type', criteria.jobType);
    }
    if (criteria.priceMin) {
      query = query.gte('pay_min', criteria.priceMin);
    }
  } else {
    if (criteria.propertyType && Array.isArray(criteria.propertyType)) {
      query = query.in('property_type', criteria.propertyType);
    }
    if (criteria.priceMin) {
      query = query.gte('price', criteria.priceMin);
    }
    if (criteria.priceMax) {
      query = query.lte('price', criteria.priceMax);
    }
    if (criteria.bedrooms) {
      query = query.gte('bedrooms', criteria.bedrooms);
    }
    if (criteria.bathrooms) {
      query = query.gte('bathrooms', criteria.bathrooms);
    }
  }

  const { data, error } = await query.limit(10);
  
  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return data || [];
}

async function sendWhatsAppNotification(
  phoneNumber: string,
  firstName: string,
  type: 'job' | 'property',
  matches: any[],
  criteria: Record<string, any>
) {
  const waPhoneId = Deno.env.get('WA_PHONE_ID');
  const waAccessToken = Deno.env.get('WA_ACCESS_TOKEN');

  if (!waPhoneId || !waAccessToken) {
    throw new Error('WhatsApp credentials not configured');
  }

  const message = formatNotificationMessage(firstName, type, matches, criteria);

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }

  return response.json();
}

function formatNotificationMessage(
  firstName: string,
  type: 'job' | 'property',
  matches: any[],
  criteria: Record<string, any>
): string {
  const emoji = type === 'job' ? '💼' : '🏠';
  const count = matches.length;
  
  let message = `Hi ${firstName}! ${emoji}\n\n`;
  message += `*New ${type} matches for your saved search!*\n\n`;
  
  // Add criteria summary
  const criteriaText = Object.entries(criteria)
    .filter(([key, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
      return `${key}: ${value}`;
    })
    .join(', ');
  
  if (criteriaText) {
    message += `📋 Search: ${criteriaText}\n\n`;
  }
  
  message += `Found ${count} new listing${count > 1 ? 's' : ''}:\n\n`;
  
  // List matches (max 5)
  matches.slice(0, 5).forEach((match, i) => {
    message += `${i + 1}. *${match.title}*\n`;
    
    if (type === 'job') {
      message += `   📍 ${match.location || 'Location TBD'}\n`;
      if (match.pay_min || match.pay_max) {
        const salary = match.pay_min && match.pay_max 
          ? `${match.pay_min}-${match.pay_max}`
          : match.pay_min || match.pay_max;
        message += `   💰 ${salary} ${match.currency || 'EUR'}\n`;
      }
      message += `   🏢 ${match.posted_by || 'Company'}\n`;
    } else {
      const location = typeof match.location === 'object' 
        ? match.location.address 
        : match.location;
      message += `   📍 ${location || 'Location TBD'}\n`;
      if (match.price) {
        message += `   💰 ${match.price} ${match.currency || 'EUR'}\n`;
      }
      if (match.bedrooms || match.bathrooms) {
        message += `   🛏️ ${match.bedrooms || 0} bed, 🚿 ${match.bathrooms || 0} bath\n`;
      }
    }
    message += '\n';
  });
  
  if (count > 5) {
    message += `_...and ${count - 5} more!_\n\n`;
  }
  
  message += `Reply with the number to see details, or type "search" to explore more!`;
  
  return message;
}
