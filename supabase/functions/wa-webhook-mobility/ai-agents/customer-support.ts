import type { RouterContext } from "../types.ts";
import { sendText } from "../wa/client.ts";
import { homeOnly } from "../utils/reply.ts";
import { IDS } from "../wa/ids.ts";
import { logStructuredEvent } from "../observe/log.ts";

// Import sendButtons correctly
async function sendButtonsMessage(
  ctx: RouterContext,
  text: string,
  buttons: Array<{ id: string; title: string }>,
  options?: { emoji?: string }
) {
  const { sendButtons } = await import("../wa/client.ts");
  // sendButtons doesn't take options, just send with text
  return await sendButtons(ctx.from, text, buttons);
}

// OpenAI integration
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface AIAgentConfig {
  agent_key: string;
  agent_name: string;
  persona: string;
  system_prompt: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  tools: any[];
}

/**
 * Start customer support AI chat
 */
export async function startCustomerSupportChat(ctx: RouterContext): Promise<boolean> {
  // Fetch AI agent config from database
  const { data: agentConfig, error } = await ctx.supabase
    .from('ai_agents_config')
    .select('*')
    .eq('agent_key', 'customer_support')
    .eq('is_active', true)
    .single();

  if (error || !agentConfig) {
    console.error("Failed to load customer support agent config:", error);
    
    // Fallback to showing human support contacts
    return await escalateToHumanSupport(ctx);
  }

  await logStructuredEvent("AI_CUSTOMER_SUPPORT_STARTED", {
    profile_id: ctx.profileId,
    wa_id: ctx.from,
    agent_key: agentConfig.agent_key
  });

  // Show initial message
  const welcomeMessage = `👋 *${agentConfig.agent_name}*\n\n` +
    `I'm here to help! Ask me anything about:\n` +
    `• Your account and registration\n` +
    `• Our services (jobs, property, transport, insurance)\n` +
    `• Payment and MOMO wallet\n` +
    `• Technical issues\n\n` +
    `💬 Type your question or tap "Talk to Human" below:`;

  await sendButtonsMessage(
    ctx,
    welcomeMessage,
    [
      { id: "escalate_to_human", title: "Talk to Human" },
      { id: IDS.BACK_MENU, title: "Back to Menu" }
    ],
    { emoji: "🤖" }
  );

  // Set state to capture next message
  await ctx.supabase
    .from('user_states')
    .upsert({
      profile_id: ctx.profileId,
      key: 'ai_customer_support_active',
      data: {
        agent_config: agentConfig,
        conversation_history: [],
        started_at: new Date().toISOString()
      }
    });

  return true;
}

/**
 * Handle customer support AI message
 */
export async function handleCustomerSupportMessage(
  ctx: RouterContext,
  userMessage: string,
  agentConfig: AIAgentConfig,
  conversationHistory: any[]
): Promise<boolean> {
  
  if (!OPENAI_API_KEY) {
    console.error("OpenAI API key not configured");
    await sendText(ctx.from, "I'm having technical difficulties. Let me connect you with a human agent.");
    return await escalateToHumanSupport(ctx);
  }

  // Build messages for OpenAI
  const messages = [
    {
      role: "system",
      content: `${agentConfig.persona}\n\n${agentConfig.system_prompt}`
    },
    ...conversationHistory,
    {
      role: "user",
      content: userMessage
    }
  ];

  try {
    // Call OpenAI API with dynamic config from database
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: agentConfig.model_name || "gpt-5",  // Per README.md: Mandatory GPT-5
        messages: messages,
        temperature: agentConfig.temperature || 0.7,
        max_tokens: agentConfig.max_tokens || 1000,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that.";

    // Send AI response
    await sendText(ctx.from, aiResponse);

    // Update conversation history
    conversationHistory.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: aiResponse }
    );

    // Save state (keep last 10 messages)
    await ctx.supabase
      .from('user_states')
      .upsert({
        profile_id: ctx.profileId,
        key: 'ai_customer_support_active',
        data: {
          agent_config: agentConfig,
          conversation_history: conversationHistory.slice(-10)
        }
      });

    // Show options
    await sendButtonsMessage(
      ctx,
      "Need more help?",
      [
        { id: "continue_ai_chat", title: "Continue chatting" },
        { id: "escalate_to_human", title: "Talk to human" },
        { id: IDS.BACK_MENU, title: "Back to menu" }
      ]
    );

    await logStructuredEvent("AI_CUSTOMER_SUPPORT_MESSAGE", {
      profile_id: ctx.profileId,
      message_count: conversationHistory.length
    });

    return true;

  } catch (error) {
    console.error("AI agent error:", error);
    
    await logStructuredEvent("AI_CUSTOMER_SUPPORT_ERROR", {
      profile_id: ctx.profileId,
      error: String(error)
    });

    await sendButtonsMessage(
      ctx,
      "I'm having trouble right now. Would you like to talk to a human support agent?",
      [
        { id: "escalate_to_human", title: "Yes, connect me" },
        { id: IDS.BACK_MENU, title: "Back to menu" }
      ]
    );
    return true;
  }
}

/**
 * Escalate to human support - show contact numbers
 */
export async function escalateToHumanSupport(ctx: RouterContext): Promise<boolean> {
  // Fetch customer support contacts from database
  const { data: contacts } = await ctx.supabase
    .from('customer_support_contacts')
    .select('*')
    .eq('is_active', true)
    .eq('department', 'customer_support')
    .order('display_order');

  if (!contacts || contacts.length === 0) {
    await sendButtonsMessage(
      ctx,
      "Support contacts are currently unavailable. Please try again later.",
      homeOnly()
    );
    return true;
  }

  const contactList = contacts
    .map((c: any) => `${c.display_name}: ${c.destination}`)
    .join('\n');

  const message = `👥 *Human Support Team*\n\n` +
    `Our support team is ready to help:\n\n${contactList}\n\n` +
    `Tap a number below to start chatting on WhatsApp.`;

  // Build contact buttons (max 3)
  const buttons = contacts.slice(0, 3).map((c: any) => ({
    id: `whatsapp_${c.id}`,
    title: c.display_name.substring(0, 20)
  }));

  buttons.push({
    id: IDS.BACK_MENU,
    title: "Back"
  });

  await sendButtonsMessage(ctx, message, buttons, { emoji: "💬" });

  // Clear AI chat state
  await ctx.supabase
    .from('user_states')
    .delete()
    .eq('profile_id', ctx.profileId)
    .eq('key', 'ai_customer_support_active');

  await logStructuredEvent("ESCALATED_TO_HUMAN_SUPPORT", {
    profile_id: ctx.profileId,
    wa_id: ctx.from
  });

  return true;
}

/**
 * End AI chat session
 */
export async function endAIChat(ctx: RouterContext): Promise<boolean> {
  await ctx.supabase
    .from('user_states')
    .delete()
    .eq('profile_id', ctx.profileId)
    .eq('key', 'ai_customer_support_active');

  await sendButtonsMessage(
    ctx,
    "Chat session ended. Feel free to reach out anytime!",
    homeOnly(),
    { emoji: "👋" }
  );

  return true;
}
