/**
 * Agent Context Builder
 * 
 * Builds comprehensive context for AI agents from WhatsApp messages
 * Extracts user profile, conversation history, and session state
 */

import type { SupabaseClient } from "../../_shared/supabase.ts";
import type { WhatsAppMessage } from "../types.ts";
import type { ChatState } from "../state/store.ts";
import type {
  DetectionResult,
  ToneLocale,
} from "../../../../packages/localization/src/index.ts";

export interface AgentContext {
  conversationId: string;
  userId?: string;
  phoneNumber: string;
  userName?: string;
  userProfile?: UserProfile;
  messageHistory: MessageHistoryItem[];
  currentMessage: string;
  messageType: string;
  sessionData: Record<string, any>;
  language: string;
  toneLocale: ToneLocale;
  toneDetection: DetectionResult;
  timestamp: string;
  correlationId: string;
  channel: "whatsapp";
  supabase: SupabaseClient;
}

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  phoneNumber: string;
  language: string;
  preferences?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  lastActiveAt?: string;
}

export interface MessageHistoryItem {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Build agent context from WhatsApp message and chat state
 */
type ToneGuidance = {
  toneLocale?: ToneLocale;
  toneDetection?: DetectionResult;
  languageHint?: string;
};

export async function buildAgentContext(
  supabase: SupabaseClient,
  message: WhatsAppMessage,
  state: ChatState,
  correlationId: string,
  tone?: ToneGuidance,
): Promise<AgentContext | null> {
  try {
    const phoneNumber = message.from || "";
    const conversationId = `wa_${phoneNumber}_${Date.now()}`;
    const resolvedTone = tone?.toneLocale ?? "en";
    const toneDetection: DetectionResult = tone?.toneDetection ?? {
      locale: resolvedTone,
      swahiliScore: resolvedTone === "sw" ? 1 : 0,
      englishScore: resolvedTone === "en" ? 1 : 0,
    };

    // Extract message content based on type
    const currentMessage = extractMessageContent(message);

    // Fetch user profile
    const userProfile = await fetchUserProfile(supabase, phoneNumber);

    // Fetch recent message history
    const messageHistory = await fetchMessageHistory(supabase, phoneNumber);

    // Build context object
    const context: AgentContext = {
      conversationId,
      userId: userProfile?.id,
      phoneNumber,
      userName: userProfile?.name,
      userProfile,
      messageHistory,
      currentMessage,
      messageType: message.type || "text",
      sessionData: state?.data || {},
      language: tone?.languageHint ?? userProfile?.language || state?.lang || "en",
      toneLocale: resolvedTone,
      toneDetection,
      timestamp: new Date().toISOString(),
      correlationId,
      channel: "whatsapp",
      supabase,
    };

    return context;
  } catch (error) {
    console.error("Failed to build agent context:", error);
    return null;
  }
}

/**
 * Extract message content from different message types
 */
function extractMessageContent(message: WhatsAppMessage): string {
  if (message.type === "text" && message.text?.body) {
    return message.text.body;
  }

  if (message.type === "interactive") {
    if (message.interactive?.type === "list_reply") {
      return message.interactive.list_reply?.title || message.interactive.list_reply?.id || "";
    }
    if (message.interactive?.type === "button_reply") {
      return message.interactive.button_reply?.title || message.interactive.button_reply?.id || "";
    }
  }

  if (message.type === "button" && message.button?.text) {
    return message.button.text;
  }

  return "";
}

/**
 * Fetch user profile from database
 */
async function fetchUserProfile(
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<UserProfile | undefined> {
  try {
    const { data, error} = await supabase
      .from("users")
      .select("id, name, email, phone_number, language, preferences, metadata, created_at, last_active_at")
      .eq("phone_number", phoneNumber)
      .single();

    if (error || !data) {
      return undefined;
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phoneNumber: data.phone_number,
      language: data.language || "en",
      preferences: data.preferences,
      metadata: data.metadata,
      createdAt: data.created_at,
      lastActiveAt: data.last_active_at,
    };
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return undefined;
  }
}

/**
 * Fetch recent message history for context
 */
async function fetchMessageHistory(
  supabase: SupabaseClient,
  phoneNumber: string,
  limit: number = 10
): Promise<MessageHistoryItem[]> {
  try {
    const { data, error } = await supabase
      .from("wa_interactions")
      .select("message_type, message_content, response_content, created_at")
      .eq("phone_number", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    const history: MessageHistoryItem[] = [];

    for (const interaction of data.reverse()) {
      // Add user message
      if (interaction.message_content) {
        const content = extractContentFromInteraction(interaction.message_content);
        if (content) {
          history.push({
            role: "user",
            content,
            timestamp: interaction.created_at,
          });
        }
      }

      // Add assistant response
      if (interaction.response_content) {
        const content = extractContentFromResponse(interaction.response_content);
        if (content) {
          history.push({
            role: "assistant",
            content,
            timestamp: interaction.created_at,
          });
        }
      }
    }

    return history.slice(-20); // Keep last 20 messages
  } catch (error) {
    console.error("Failed to fetch message history:", error);
    return [];
  }
}

/**
 * Extract content from stored interaction
 */
function extractContentFromInteraction(messageContent: any): string {
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (messageContent?.text?.body) {
    return messageContent.text.body;
  }

  if (messageContent?.interactive?.list_reply?.title) {
    return messageContent.interactive.list_reply.title;
  }

  if (messageContent?.interactive?.button_reply?.title) {
    return messageContent.interactive.button_reply.title;
  }

  return "";
}

/**
 * Extract content from stored response
 */
function extractContentFromResponse(responseContent: any): string {
  if (typeof responseContent === "string") {
    return responseContent;
  }

  if (responseContent?.text?.body) {
    return responseContent.text.body;
  }

  return "";
}

/**
 * Save agent interaction to database
 */
export async function saveAgentInteraction(
  supabase: SupabaseClient,
  context: AgentContext,
  request: string,
  response: string,
  agentType: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from("wa_interactions").insert({
      user_id: context.userId,
      phone_number: context.phoneNumber,
      message_type: "ai_agent",
      message_content: { text: { body: request } },
      response_content: { text: { body: response } },
      correlation_id: context.correlationId,
      metadata: {
        agent_type: agentType,
        language: context.language,
        ...metadata,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to save agent interaction:", error);
  }
}
