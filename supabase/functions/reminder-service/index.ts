import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      follow_up_reminders: 0,
      viewing_reminders: 0,
      errors: [] as string[],
    };

    // 1. Check for follow-up reminders (job applications)
    const today = new Date().toISOString().split('T')[0];
    
    const { data: applications, error: appsError } = await supabase
      .from('job_applications')
      .select('*, whatsapp_users(*), job_listings(*)')
      .eq('follow_up_date', today)
      .eq('reminder_sent', false)
      .not('status', 'in', '(rejected,withdrawn,accepted)');

    if (appsError) {
      results.errors.push(`Failed to fetch applications: ${appsError.message}`);
    } else if (applications && applications.length > 0) {
      for (const app of applications) {
        try {
          await sendFollowUpReminder(
            app.whatsapp_users.phone_number,
            app.whatsapp_users.first_name || 'there',
            app.job_listings?.title || 'your application',
            app.job_listings?.posted_by || 'the company'
          );

          await supabase
            .from('job_applications')
            .update({ reminder_sent: true })
            .eq('id', app.id);

          results.follow_up_reminders++;
        } catch (e) {
          results.errors.push(`Follow-up ${app.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    // 2. Check for viewing reminders (24 hours before)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();

    const { data: viewings, error: viewingsError } = await supabase
      .from('property_viewings')
      .select('*, whatsapp_users(*), property_listings(*)')
      .gte('viewing_date', tomorrowStart)
      .lte('viewing_date', tomorrowEnd)
      .eq('reminder_sent', false)
      .eq('confirmation_status', 'confirmed');

    if (viewingsError) {
      results.errors.push(`Failed to fetch viewings: ${viewingsError.message}`);
    } else if (viewings && viewings.length > 0) {
      for (const viewing of viewings) {
        try {
          await sendViewingReminder(
            viewing.whatsapp_users.phone_number,
            viewing.whatsapp_users.first_name || 'there',
            viewing.property_listings?.title || 'property',
            new Date(viewing.viewing_date),
            viewing.property_listings?.location
          );

          await supabase
            .from('property_viewings')
            .update({ reminder_sent: true })
            .eq('id', viewing.id);

          results.viewing_reminders++;
        } catch (e) {
          results.errors.push(`Viewing ${viewing.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
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
        follow_up_reminders: 0,
        viewing_reminders: 0,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function sendFollowUpReminder(
  phoneNumber: string,
  firstName: string,
  jobTitle: string,
  company: string
) {
  const waPhoneId = Deno.env.get('WA_PHONE_ID');
  const waAccessToken = Deno.env.get('WA_ACCESS_TOKEN');

  if (!waPhoneId || !waAccessToken) {
    throw new Error('WhatsApp credentials not configured');
  }

  const message = `Hi ${firstName}! 📅\n\n` +
    `*Follow-up Reminder*\n\n` +
    `You wanted to follow up on your application for:\n` +
    `💼 *${jobTitle}*\n` +
    `🏢 ${company}\n\n` +
    `This is a good time to:\n` +
    `• Check your application status\n` +
    `• Send a follow-up email\n` +
    `• Reach out to the recruiter\n\n` +
    `Good luck! 🍀`;

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

async function sendViewingReminder(
  phoneNumber: string,
  firstName: string,
  propertyTitle: string,
  viewingDate: Date,
  location: any
) {
  const waPhoneId = Deno.env.get('WA_PHONE_ID');
  const waAccessToken = Deno.env.get('WA_ACCESS_TOKEN');

  if (!waPhoneId || !waAccessToken) {
    throw new Error('WhatsApp credentials not configured');
  }

  const locationText = typeof location === 'object' 
    ? location.address 
    : location || 'See property details';

  const dateStr = viewingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const timeStr = viewingDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const message = `Hi ${firstName}! 🏠\n\n` +
    `*Property Viewing Reminder*\n\n` +
    `You have a viewing scheduled for tomorrow:\n\n` +
    `🏠 *${propertyTitle}*\n` +
    `📍 ${locationText}\n` +
    `📅 ${dateStr}\n` +
    `🕐 ${timeStr}\n\n` +
    `Don't forget to:\n` +
    `• Arrive on time\n` +
    `• Bring ID if required\n` +
    `• Prepare questions\n\n` +
    `See you there! 👋`;

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
