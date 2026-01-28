/**
 * Intent Notification Opt-Out Handler
 * 
 * Handles WhatsApp interactive button clicks for intent notifications:
 * - Stop notifications button (interactive button reply)
 * - SUBSCRIBE text message (opt back in)
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js';

import { logStructuredEvent } from '../../_shared/observability.ts';

const WA_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WA_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

/**
 * Check if message is an opt-out/opt-in request and handle it
 * Returns true if handled, false if should continue to normal routing
 */
export async function handleIntentOptOut(
  payload: any,
  supabase: SupabaseClient
): Promise<boolean> {
  const entry = payload?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages?.[0];

  if (!messages) {
    return false;
  }

  const from = messages.from;
  const messageType = messages.type;

  // Handle interactive button click (stop notifications)
  if (messageType === 'interactive') {
    const buttonReply = messages.interactive?.button_reply;
    if (buttonReply && buttonReply.id?.startsWith('stop_notifications_')) {
      await processOptOut(from, buttonReply.id, supabase);
      return true; // Handled
    }
  }

  // Handle text message for SUBSCRIBE
  if (messageType === 'text') {
    const text = messages.text?.body?.trim().toUpperCase();
    if (text === 'SUBSCRIBE' || text === 'OPT IN' || text === 'START' || text === 'OPTIN') {
      await processOptIn(from, supabase);
      return true; // Handled
    }
    
    // Also handle STOP, UNSUBSCRIBE
    if (text === 'STOP' || text === 'UNSUBSCRIBE' || text === 'OPTOUT' || text === 'OPT OUT') {
      await processOptOut(from, 'text_command', supabase);
      return true; // Handled
    }
  }

  return false; // Not an opt-out/opt-in message
}

/**
 * Process opt-out request
 */
async function processOptOut(
  phoneNumber: string,
  source: string,
  supabase: SupabaseClient
) {
  await logStructuredEvent('PROCESSING_OPT_OUT', {
    phone: phoneNumber.slice(-4),
    source,
  });

  try {
    // Call database function to opt out
    const { data, error } = await supabase
      .rpc('opt_out_intent_notifications', {
        p_phone_number: phoneNumber,
        p_reason: source.startsWith('stop_notifications_') ? 'Button click' : 'Text command',
      });

    if (error) {
      throw new Error(`Failed to opt out: ${error.message}`);
    }

    await logStructuredEvent('OPT_OUT_COMPLETE', {
      phone: phoneNumber.slice(-4),
      message: data?.message,
    });

    // Send confirmation message
    await sendWhatsAppMessage(
      phoneNumber,
      '🔕 *Notifications Stopped*\n\n' +
      'You will no longer receive match notifications from EasyMO.\n\n' +
      'Your pending intents have been cancelled.\n\n' +
      '📱 To start receiving notifications again, reply *SUBSCRIBE*.'
    );

  } catch (error) {
    await logStructuredEvent('OPT_OUT_ERROR', {
      phone: phoneNumber.slice(-4),
      error: error instanceof Error ? error.message : String(error),
    }, 'error');

    // Send error message to user
    await sendWhatsAppMessage(
      phoneNumber,
      '❌ Sorry, there was an error processing your request. Please try again or contact support.'
    );
  }
}

/**
 * Process opt-in request
 */
async function processOptIn(
  phoneNumber: string,
  supabase: SupabaseClient
) {
  await logStructuredEvent('PROCESSING_OPT_IN', {
    phone: phoneNumber.slice(-4),
  });

  try {
    // Call database function to opt in
    const { data, error } = await supabase
      .rpc('opt_in_intent_notifications', {
        p_phone_number: phoneNumber,
      });

    if (error) {
      throw new Error(`Failed to opt in: ${error.message}`);
    }

    await logStructuredEvent('OPT_IN_COMPLETE', {
      phone: phoneNumber.slice(-4),
      message: data?.message,
    });

    // Send confirmation message
    await sendWhatsAppMessage(
      phoneNumber,
      '✅ *Welcome Back!*\n\n' +
      'You are now subscribed to match notifications.\n\n' +
      'We\'ll notify you when we find matches for your requests.\n\n' +
      '💬 To stop notifications anytime:\n' +
      '• Click "🔕 Stop notifications" button on any notification\n' +
      '• Or reply *STOP*'
    );

  } catch (error) {
    await logStructuredEvent('OPT_IN_ERROR', {
      phone: phoneNumber.slice(-4),
      error: error instanceof Error ? error.message : String(error),
    }, 'error');

    // Send error message to user
    await sendWhatsAppMessage(
      phoneNumber,
      '❌ Sorry, there was an error processing your request. Please try again or contact support.'
    );
  }
}

/**
 * Send WhatsApp text message
 */
async function sendWhatsAppMessage(to: string, message: string) {
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) {
    await logStructuredEvent('WHATSAPP_CONFIG_MISSING', {
      hasToken: !!WA_ACCESS_TOKEN,
      hasPhoneId: !!WA_PHONE_NUMBER_ID,
    }, 'warn');
    return;
  }

  try {
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
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.statusText} - ${errorText}`);
    }

    await logStructuredEvent('OPT_OUT_CONFIRMATION_SENT', {
      phone: to.slice(-4),
    });

  } catch (error) {
    await logStructuredEvent('OPT_OUT_SEND_ERROR', {
      phone: to.slice(-4),
      error: error instanceof Error ? error.message : String(error),
    }, 'error');
  }
}
