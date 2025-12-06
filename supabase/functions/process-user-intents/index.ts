/**
 * Process User Intents - Background Matching & WhatsApp Notifications
 * 
 * Scheduled function that:
 * 1. Processes queued user intents
 * 2. Finds matching listings (properties, jobs, produce, etc.)
 * 3. Sends WhatsApp notifications with matches
 * 
 * Invoked by: Cron job (every 5 minutes) or manual trigger
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStructuredEvent } from '../_shared/observability.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const WA_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WA_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

interface UserIntent {
  id: string;
  phone_number: string;
  intent_type: string;
  location_text: string;
  details: Record<string, any>;
  language: string;
  urgency: string;
}

interface Match {
  type: string;
  id: string;
  score: number;
  details: Record<string, any>;
}

serve(async (req: Request) => {
  try {
    await logStructuredEvent('INTENT_PROCESSOR_START', {});

    // Calculate time window (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Get queued intents within time window (limit 10 per run)
    const { data: queue, error: queueError } = await supabase
      .from('intent_processing_queue')
      .select(`
        id,
        intent_id,
        intent_type,
        retry_count,
        user_intents (*)
      `)
      .eq('status', 'queued')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    if (!queue?.length) {
      return new Response(JSON.stringify({ 
        success: true,
        processed: 0,
        message: 'No intents to process'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let processed = 0;
    let errors = 0;

    for (const item of queue) {
      const intent = (item as any).user_intents as unknown as UserIntent;
      
      try {
        // Mark as processing
        await supabase
          .from('intent_processing_queue')
          .update({ status: 'processing' })
          .eq('id', item.id);

        // Find matches based on intent type
        const matches = await findMatches(intent);

        if (matches.length > 0) {
          // Store matches
          const { error: matchError } = await supabase
            .from('intent_matches')
            .insert(
              matches.map(m => ({
                intent_id: intent.id,
                match_type: m.type,
                match_id: m.id,
                match_score: m.score,
                match_details: m.details,
              }))
            );

          if (matchError) throw matchError;

          // Check if user has opted out of notifications
          const { data: notifPref } = await supabase
            .from('intent_notification_preferences')
            .select('notifications_enabled')
            .eq('phone_number', intent.phone_number)
            .maybeSingle();

          const notificationsEnabled = notifPref?.notifications_enabled ?? true;

          if (notificationsEnabled) {
            // Send WhatsApp notification
            await sendMatchNotification(intent, matches);
            
            // Update intent status
            await supabase
              .from('user_intents')
              .update({ 
                status: 'notified', 
                matched_at: new Date().toISOString(),
                notified_at: new Date().toISOString(),
              })
              .eq('id', intent.id);
          } else {
            // User opted out - just mark as matched without notification
            await supabase
              .from('user_intents')
              .update({ 
                status: 'matched', 
                matched_at: new Date().toISOString(),
              })
              .eq('id', intent.id);

            await logStructuredEvent('INTENT_NOTIFICATION_SKIPPED', {
              intentId: intent.id,
              reason: 'User opted out',
            });
          }
        } else {
          // No matches found - keep as pending for retry
          await supabase
            .from('user_intents')
            .update({ status: 'pending_match' })
            .eq('id', intent.id);
        }

        // Mark queue item as completed
        await supabase
          .from('intent_processing_queue')
          .update({ 
            status: 'completed', 
            processed_at: new Date().toISOString() 
          })
          .eq('id', item.id);

        processed++;

        await logStructuredEvent('INTENT_PROCESSED', {
          intentId: intent.id,
          intentType: intent.intent_type,
          matchCount: matches.length,
        });

      } catch (error) {
        errors++;

        const retryCount = (item as any).retry_count || 0;
        const maxRetries = (item as any).max_retries || 3;

        if (retryCount >= maxRetries) {
          // Max retries reached - mark as failed
          await supabase
            .from('intent_processing_queue')
            .update({ 
              status: 'failed',
              last_error: error instanceof Error ? error.message : String(error),
            })
            .eq('id', item.id);
        } else {
          // Retry later
          await supabase
            .from('intent_processing_queue')
            .update({ 
              status: 'queued',
              retry_count: retryCount + 1,
              last_error: error instanceof Error ? error.message : String(error),
            })
            .eq('id', item.id);
        }

        await logStructuredEvent('INTENT_PROCESSING_ERROR', {
          intentId: intent.id,
          error: error instanceof Error ? error.message : String(error),
        }, 'error');
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed,
      errors,
      total: queue.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    await logStructuredEvent('INTENT_PROCESSOR_FATAL_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    }, 'error');

    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Find matches for a user intent
 */
async function findMatches(intent: UserIntent): Promise<Match[]> {
  const matches: Match[] = [];

  switch (intent.intent_type) {
    case 'property_seeker': {
      const { data } = await supabase
        .from('property_listings')
        .select('*')
        .ilike('city', `%${intent.location_text}%`)
        .eq('listing_type', intent.details.listing_type || 'rent')
        .lte('price', intent.details.max_budget || 9999999)
        .gte('bedrooms', intent.details.bedrooms || 1)
        .eq('status', 'active')
        .limit(5);

      matches.push(...(data || []).map(p => ({
        type: 'property_listing',
        id: p.id,
        score: calculatePropertyScore(p, intent),
        details: {
          title: `${p.bedrooms}BR ${intent.details.listing_type === 'rent' ? 'Rental' : 'For Sale'} in ${p.city}`,
          price: `${p.price} ${p.currency}${intent.details.listing_type === 'rent' ? '/month' : ''}`,
          location: p.area || p.city,
          bedrooms: p.bedrooms,
        },
      })));
      break;
    }

    case 'job_seeker': {
      const { data } = await supabase
        .from('job_listings')
        .select('*')
        .ilike('location', `%${intent.location_text}%`)
        .eq('status', 'open')
        .limit(5);

      matches.push(...(data || []).map(j => ({
        type: 'job_listing',
        id: j.id,
        score: 0.8,
        details: {
          title: j.title,
          company: j.company_name || 'Company',
          pay: j.pay_amount ? `${j.pay_amount} ${j.pay_type}` : 'Negotiable',
          location: j.location,
          type: j.job_type || 'Full-time',
        },
      })));
      break;
    }

    case 'farmer_seller': {
      // Find buyers looking for this produce
      const { data } = await supabase
        .from('user_intents')
        .select('*')
        .eq('intent_type', 'farmer_buyer')
        .eq('status', 'pending_match')
        .contains('details', { product_type: intent.details.product_type });

      matches.push(...(data || []).map(b => ({
        type: 'buyer_intent',
        id: b.id,
        score: 0.9,
        details: {
          product: intent.details.product_type,
          buyer_location: b.location_text,
          quantity_needed: b.details.quantity_needed,
          contact: 'Available via EasyMO',
        },
      })));
      break;
    }

    case 'farmer_buyer': {
      // Find sellers with this produce
      const { data } = await supabase
        .from('user_intents')
        .select('*')
        .eq('intent_type', 'farmer_seller')
        .eq('status', 'pending_match')
        .contains('details', { product_type: intent.details.product_type });

      matches.push(...(data || []).map(s => ({
        type: 'seller_intent',
        id: s.id,
        score: 0.9,
        details: {
          product: intent.details.product_type,
          seller_location: s.location_text,
          quantity_available: s.details.quantity,
          unit: s.details.unit,
          price: s.details.price_per_unit ? `${s.details.price_per_unit}/${s.details.unit}` : 'Negotiable',
        },
      })));
      break;
    }

    case 'job_poster': {
      // Find job seekers matching requirements
      const { data } = await supabase
        .from('user_intents')
        .select('*')
        .eq('intent_type', 'job_seeker')
        .eq('status', 'pending_match')
        .ilike('location_text', `%${intent.location_text}%`)
        .limit(5);

      matches.push(...(data || []).map(s => ({
        type: 'job_seeker_intent',
        id: s.id,
        score: 0.7,
        details: {
          skills: s.details.skills?.join(', ') || 'Various skills',
          location: s.location_text,
          availability: s.details.availability || 'Available',
          job_type: s.details.job_type || 'Open to opportunities',
        },
      })));
      break;
    }
  }

  return matches;
}

/**
 * Calculate property match score (0.0 to 1.0)
 */
function calculatePropertyScore(property: any, intent: UserIntent): number {
  let score = 0.6; // Base score

  // Location match
  if (property.city?.toLowerCase().includes(intent.location_text.toLowerCase())) {
    score += 0.2;
  }

  // Budget match
  const budget = intent.details.max_budget || 9999999;
  if (property.price <= budget) {
    score += 0.1;
  }

  // Bedroom match
  const desiredBedrooms = intent.details.bedrooms || 1;
  if (property.bedrooms === desiredBedrooms) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Send WhatsApp notification with matches and opt-out button
 */
async function sendMatchNotification(intent: UserIntent, matches: Match[]) {
  const message = formatMatchesForWhatsApp(intent, matches);

  // Send interactive message with button
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: intent.phone_number,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: message
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: `stop_notifications_${intent.id}`,
                  title: '🔕 Stop notifications'
                }
              }
            ]
          }
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${response.statusText} - ${errorText}`);
  }

  // Mark matches as notified
  await supabase
    .from('intent_matches')
    .update({ 
      notified: true,
      notification_sent_at: new Date().toISOString()
    })
    .eq('intent_id', intent.id);

  await logStructuredEvent('INTENT_NOTIFICATION_SENT', {
    intentId: intent.id,
    intentType: intent.intent_type,
    matchCount: matches.length,
    phone: intent.phone_number.slice(-4),
  });
}

/**
 * Format matches into WhatsApp message
 */
function formatMatchesForWhatsApp(intent: UserIntent, matches: Match[]): string {
  const header = getNotificationHeader(intent);
  
  const matchList = matches.slice(0, 3).map((m, i) => {
    return formatMatchItem(i + 1, m);
  }).join('\n\n');

  const footer = matches.length > 3 
    ? `\n\n📋 Plus ${matches.length - 3} more options available!`
    : '';

  return `${header}\n\n${matchList}${footer}\n\n💬 Reply "more" to see all options or "details [number]" for info.`;
}

/**
 * Get notification header based on intent type
 */
function getNotificationHeader(intent: UserIntent): string {
  switch (intent.intent_type) {
    case 'property_seeker':
      return `🏠 *Great news!* We found properties matching your search in ${intent.location_text}:`;
    case 'job_seeker':
      return `👔 *Good news!* We found jobs that match what you're looking for:`;
    case 'farmer_seller':
      return `🌾 *Buyer found!* Someone is interested in your ${intent.details.product_type}:`;
    case 'farmer_buyer':
      return `🌾 *Seller found!* We found ${intent.details.product_type} for you:`;
    case 'job_poster':
      return `👔 *Candidates available!* We found people interested in your job:`;
    default:
      return `✅ *We found matches for your request:*`;
  }
}

/**
 * Format individual match item
 */
function formatMatchItem(num: number, match: Match): string {
  const d = match.details;
  
  switch (match.type) {
    case 'property_listing':
      return `${num}️⃣ *${d.title}*\n   📍 ${d.location}\n   💰 ${d.price}`;
    
    case 'job_listing':
      return `${num}️⃣ *${d.title}* at ${d.company}\n   📍 ${d.location}\n   💰 ${d.pay}\n   ⏰ ${d.type}`;
    
    case 'buyer_intent':
      return `${num}️⃣ Buyer needs *${d.product}*\n   📍 ${d.buyer_location}\n   📦 Quantity: ${d.quantity_needed}\n   📞 ${d.contact}`;
    
    case 'seller_intent':
      return `${num}️⃣ Seller has *${d.product}*\n   📍 ${d.seller_location}\n   📦 ${d.quantity_available} ${d.unit}\n   💰 ${d.price}`;
    
    case 'job_seeker_intent':
      return `${num}️⃣ Candidate\n   🎯 Skills: ${d.skills}\n   📍 ${d.location}\n   ⏰ ${d.availability}`;
    
    default:
      return `${num}️⃣ ${JSON.stringify(d)}`;
  }
}
