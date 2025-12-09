import { t } from "../../i18n/translator.ts";
import { setState } from "../../state/store.ts";
import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";

/**
 * Start Business Broker AI Agent (Buy & Sell)
 * Smart tag-based business discovery with natural language chat
 */
export async function handleGeneralBrokerStart(ctx: RouterContext): Promise<boolean> {
  // Set state to indicate user is in business broker AI flow
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "business_broker_chat",
      data: { 
        active: true, 
        started_at: new Date().toISOString(),
        agent_type: "business_broker"
      },
    });
  }

  // Send welcome message with instructions
  const welcomeMessage = t(ctx.locale, "businessBroker.welcome") ||
    `🤖 *Chat with Agent*

Welcome! I'm your AI business assistant. I can help you find:

💊 Pharmacies & medicine
🍔 Restaurants & food
✂️ Salons & barbers  
📱 Electronics & repairs
🏗️ Hardware & construction
🏪 Any local business or service

Just tell me what you're looking for in natural language!

Examples:
• "I need medicine for headache"
• "find phone repair near me"
• "hungry want pizza"
• "haircut in Kigali"

What can I help you find today?`;

  await sendText(ctx.from, welcomeMessage);

  return true;
}
