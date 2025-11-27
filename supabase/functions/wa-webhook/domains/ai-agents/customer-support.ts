/**
 * Customer Support AI Agent - Handles general help, navigation, and support requests
 * Integrated with WhatsApp webhook for natural language support conversations
 */

import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendText, buildButtons } from "../../utils/reply.ts";
import { logStructuredEvent } from "../../../_shared/observability.ts";
import { createDualLLMAgentConfig } from "../../shared/agent_configs.ts";

interface SupportSession {
  sessionId: string;
  userId: string;
  issueCategory?: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  resolved: boolean;
  escalated: boolean;
  createdAt: string;
}

/**
 * Start a customer support chat session
 */
export async function startCustomerSupportChat(ctx: RouterContext): Promise<boolean> {
  const { from, profileId, supabase } = ctx;

  await logStructuredEvent("SUPPORT_CHAT_STARTED", {
    profileId,
    from,
    channel: "whatsapp",
  });

  // Check if there's an active support session
  const { data: existingSession } = await supabase
    .from("ai_chat_sessions")
    .select("*")
    .eq("profile_id", profileId)
    .eq("agent_slug", "support")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingSession) {
    // Resume existing session
    await sendText(
      from,
      "👋 Welcome back! I'm here to help you with any questions or issues.\n\n" +
      "What can I assist you with today?"
    );
  } else {
    // Start new session
    const { data: newSession, error } = await supabase
      .from("ai_chat_sessions")
      .insert({
        profile_id: profileId,
        agent_slug: "support",
        status: "active",
        channel: "whatsapp",
        metadata: {
          from,
          startedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create support session:", error);
    }

    await sendText(
      from,
      "👋 Hi! I'm EasyMO's Customer Support Assistant.\n\n" +
      "I can help you with:\n" +
      "• Ordering food 🍽️\n" +
      "• Booking rides 🚗\n" +
      "• Finding jobs 💼\n" +
      "• Property rentals 🏠\n" +
      "• Payments & wallet 💳\n" +
      "• Technical issues 🔧\n" +
      "• General questions ❓\n\n" +
      "What would you like help with?"
    );

    await logStructuredEvent("SUPPORT_SESSION_CREATED", {
      sessionId: newSession?.id,
      profileId,
    });
  }

  // Show quick action buttons
  await sendButtonsMessage(
    ctx,
    "Choose a category or type your question:",
    buildButtons([
      { id: "support_payment", title: "💳 Payment Issue" },
      { id: "support_technical", title: "🔧 Technical Help" },
      { id: "support_navigation", title: "🧭 Navigation Help" },
      { id: "support_other", title: "❓ Other Question" },
    ])
  );

  return true;
}

/**
 * Handle support message with AI agent
 */
export async function handleSupportMessage(
  ctx: RouterContext,
  userMessage: string
): Promise<boolean> {
  const { from, profileId, supabase } = ctx;

  // Get active support session
  const { data: session } = await supabase
    .from("ai_chat_sessions")
    .select("*")
    .eq("profile_id", profileId)
    .eq("agent_slug", "support")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    // No active session, start one
    return await startCustomerSupportChat(ctx);
  }

  // Get agent configuration
  const { data: agentConfig } = await supabase
    .from("ai_agents")
    .select(`
      *,
      ai_agent_personas(*),
      ai_agent_system_instructions(*),
      ai_agent_tools(*)
    `)
    .eq("slug", "support")
    .eq("is_active", true)
    .single();

  if (!agentConfig) {
    await sendText(from, "⚠️ Support agent is currently unavailable. Please try again later.");
    return false;
  }

  // Log the message
  await logStructuredEvent("SUPPORT_MESSAGE_RECEIVED", {
    sessionId: session.id,
    profileId,
    messageLength: userMessage.length,
  });

  // Process with AI (simplified - in production, this would call OpenAI/Gemini)
  const response = await generateSupportResponse(userMessage, agentConfig, session);

  // Send response
  await sendText(from, response);

  // Save interaction
  await supabase.from("ai_chat_messages").insert({
    session_id: session.id,
    role: "user",
    content: userMessage,
  });

  await supabase.from("ai_chat_messages").insert({
    session_id: session.id,
    role: "assistant",
    content: response,
  });

  // Check if issue is resolved
  if (isResolutionMessage(userMessage)) {
    await sendButtonsMessage(
      ctx,
      "Is your issue resolved?",
      buildButtons([
        { id: "support_resolved", title: "✅ Yes, thanks!" },
        { id: "support_continue", title: "❌ I need more help" },
      ])
    );
  }

  return true;
}

/**
 * Escalate to human support
 */
export async function escalateToHumanSupport(ctx: RouterContext): Promise<boolean> {
  const { from, profileId, supabase } = ctx;

  await logStructuredEvent("SUPPORT_ESCALATED", {
    profileId,
    from,
  });

  // Get user profile for context
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, full_name, country")
    .eq("id", profileId)
    .single();

  // Create support ticket
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      profile_id: profileId,
      category: "escalation",
      priority: "high",
      description: "Escalated from AI support agent",
      status: "open",
      metadata: {
        phone: profile?.phone,
        country: profile?.country,
        escalatedAt: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create support ticket:", error);
    await sendText(
      from,
      "⚠️ I'm having trouble creating a support ticket. Please try again or contact us directly."
    );
    return false;
  }

  await sendText(
    from,
    `✅ I've escalated your case to our support team.\n\n` +
    `📝 Ticket #${ticket.id?.slice(0, 8)}\n\n` +
    `A human agent will contact you within 1-2 hours during business hours.\n\n` +
    `Is there anything else I can help you with while you wait?`
  );

  await sendButtonsMessage(
    ctx,
    "Would you like to:",
    buildButtons([
      { id: "continue_ai_chat", title: "💬 Continue chatting" },
      { id: "home", title: "🏠 Back to home" },
    ])
  );

  return true;
}

/**
 * Handle support button actions
 */
export async function handleSupportButton(
  ctx: RouterContext,
  buttonId: string
): Promise<boolean> {
  const { from, profileId, supabase } = ctx;

  switch (buttonId) {
    case "support_payment":
      await sendText(
        from,
        "💳 I can help with payment issues.\n\n" +
        "Common issues:\n" +
        "• Payment failed but money deducted\n" +
        "• Transaction not reflecting\n" +
        "• Refund status\n\n" +
        "Please describe your issue:"
      );
      break;

    case "support_technical":
      await sendText(
        from,
        "🔧 Let me help you troubleshoot.\n\n" +
        "What's happening?\n" +
        "• App not loading\n" +
        "• Error messages\n" +
        "• Features not working\n\n" +
        "Please describe the problem:"
      );
      break;

    case "support_navigation":
      await sendText(
        from,
        "🧭 I'll help you navigate EasyMO.\n\n" +
        "What would you like to do?\n" +
        "• Order food\n" +
        "• Book a ride\n" +
        "• Find jobs\n" +
        "• Rent property\n" +
        "• Manage wallet\n\n" +
        "Tell me what you're looking for:"
      );
      break;

    case "support_other":
      await sendText(
        from,
        "❓ I'm here to help with any question.\n\n" +
        "What would you like to know?"
      );
      break;

    case "support_resolved":
      // Mark session as resolved
      await supabase
        .from("ai_chat_sessions")
        .update({ status: "resolved", updated_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .eq("agent_slug", "support")
        .eq("status", "active");

      await sendText(
        from,
        "🎉 Great! I'm glad I could help.\n\n" +
        "Feel free to reach out anytime you need assistance!"
      );

      await logStructuredEvent("SUPPORT_SESSION_RESOLVED", { profileId });
      
      // Return to home menu
      const { sendHomeMenu } = await import("../../flows/home.ts");
      return await sendHomeMenu(ctx);

    case "support_continue":
      await sendText(
        from,
        "No problem! What else can I help you with?"
      );
      break;

    default:
      return false;
  }

  return true;
}

/**
 * Generate AI response (simplified placeholder)
 * In production, this would call OpenAI/Gemini API
 */
async function generateSupportResponse(
  userMessage: string,
  agentConfig: any,
  session: any
): Promise<string> {
  const lowerMessage = userMessage.toLowerCase();

  // Simple keyword-based responses (replace with actual AI in production)
  if (lowerMessage.includes("order") || lowerMessage.includes("food")) {
    return "🍽️ To order food:\n" +
      "1. Tap 'Waiter AI' from home menu\n" +
      "2. Browse restaurants near you\n" +
      "3. Add items to your order\n" +
      "4. Confirm and pay with Mobile Money\n\n" +
      "Need help with a specific step?";
  }

  if (lowerMessage.includes("ride") || lowerMessage.includes("trip")) {
    return "🚗 To book a ride:\n" +
      "1. Tap 'Rides AI' from home menu\n" +
      "2. Set your pickup location\n" +
      "3. Choose your destination\n" +
      "4. Select ride type and confirm\n\n" +
      "Would you like me to start a booking for you?";
  }

  if (lowerMessage.includes("payment") || lowerMessage.includes("money")) {
    return "💳 For payment issues:\n" +
      "• Check your Mobile Money balance\n" +
      "• Verify the transaction reference\n" +
      "• Most refunds process within 24 hours\n\n" +
      "Do you need me to escalate this to our finance team?";
  }

  if (lowerMessage.includes("job") || lowerMessage.includes("work")) {
    return "💼 To find jobs:\n" +
      "1. Tap 'Jobs AI' from home menu\n" +
      "2. Browse available positions\n" +
      "3. Filter by location and type\n" +
      "4. Apply directly through WhatsApp\n\n" +
      "What type of work are you looking for?";
  }

  // Default response
  return "I understand you need help. Let me find the best way to assist you.\n\n" +
    "Could you provide a few more details about your question?";
}

/**
 * Check if message indicates resolution
 */
function isResolutionMessage(message: string): boolean {
  const resolutionKeywords = [
    "thanks", "thank you", "solved", "fixed", "working now",
    "got it", "understand", "clear", "merci", "murakoze"
  ];
  
  const lowerMessage = message.toLowerCase();
  return resolutionKeywords.some(keyword => lowerMessage.includes(keyword));
}
