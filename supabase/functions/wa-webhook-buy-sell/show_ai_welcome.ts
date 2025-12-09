/**
 * Show AI-powered natural language welcome for Chat with Agent
 * Replaces category-based browsing with conversational search
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { ensureProfile, setState } from "../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

export async function showAIWelcome(
  userPhone: string,
  userCountry: string = "RW"
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Ensure profile exists and set state for AI chat mode
  const profileId = await ensureProfile(supabase, userPhone, userCountry);
  if (profileId) {
    await setState(supabase, profileId, {
      key: "business_broker_chat",
      data: {
        active: true,
        started_at: new Date().toISOString(),
        agent_type: "business_broker",
      },
    });
  }

  // Send welcome message (English only - no Kinyarwanda translation)
  const welcomeMessage = `🤖 *Chat with Agent*

Welcome! I'm your AI business assistant.

I can help you find ANY local business or service:
💊 Pharmacies  🍔 Restaurants  ✂️ Salons
📱 Electronics  🏗️ Hardware  🏪 Shops

Just tell me what you're looking for!

Examples:
• "I need medicine"
• "phone repair near me"
• "hungry want pizza"
• "haircut"

What are you looking for?`;

  await sendText(userPhone, welcomeMessage);

  // Log event
  await logStructuredEvent("CHAT_AGENT_WELCOME_SHOWN", {
    wa_id: `***${userPhone.slice(-4)}`,
    country: userCountry,
  });
}
