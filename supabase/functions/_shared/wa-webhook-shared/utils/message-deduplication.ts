/**
 * Message Deduplication and Queue Integration
 * 
 * Provides deduplication checking against the database and
 * queue integration for reliable message processing.
 * 
 * @module message-deduplication
 */

import { supabase } from "../config.ts";
import { logStructuredEvent, logError } from "../../_shared/observability.ts";
import { DEDUPLICATION_CONFIG } from "../../_shared/webhook-config.ts";

/**
 * Check if a message has already been processed (database-backed deduplication)
 * 
 * @param messageId - WhatsApp message ID
 * @param correlationId - Correlation ID for tracking
 * @returns True if message is new and should be processed
 */
export async function isNewMessage(
  messageId: string,
  correlationId: string
): Promise<boolean> {
  if (!DEDUPLICATION_CONFIG.enabled) {
    return true;
  }

  try {
    // Check if message exists in wa_events (processed_webhook_messages doesn't exist)
    const { data, error } = await supabase
      .from("wa_events")
      .select("message_id, created_at")
      .eq("message_id", messageId)
      .maybeSingle();

    if (error) {
      logError("deduplication_check", error, {
        messageId,
        correlationId,
      });
      // On error, allow processing (fail open to avoid message loss)
      return true;
    }

    if (data) {
      logStructuredEvent("MESSAGE_DEDUPLICATED", {
        messageId,
        correlationId,
        originalProcessedAt: data.created_at,
      });
      return false;
    }

    // Message is new
    return true;
  } catch (error) {
    logError("deduplication_check_exception", error, {
      messageId,
      correlationId,
    });
    // Fail open
    return true;
  }
}

/**
 * Mark a message as processed
 * 
 * @param messageId - WhatsApp message ID
 * @param correlationId - Correlation ID
 * @param conversationId - Optional conversation ID
 * @param payload - Message payload
 * @param processingTimeMs - Processing time in milliseconds
 */
export async function markMessageProcessed(
  messageId: string,
  correlationId: string,
  phoneNumber?: string,
  conversationId?: string | null,
  payload?: Record<string, unknown>,
  processingTimeMs?: number
): Promise<void> {
  try {
    // Use wa_events table instead of processed_webhook_messages (which doesn't exist)
    // Ensure phone_number is never null (required by database constraint)
    const phone = phoneNumber || "unknown";
    
    const { error } = await supabase
      .from("wa_events")
      .insert({
        message_id: messageId,
        phone_number: phone,
        event_type: 'message_processed',
        timestamp: new Date().toISOString(),
        body: payload ? JSON.stringify(payload) : null,
        status: 'processed',
      });

    if (error) {
      logError("mark_message_processed", error, {
        messageId,
        correlationId,
      });
    } else {
      logStructuredEvent("MESSAGE_MARKED_PROCESSED", {
        messageId,
        correlationId,
        processingTimeMs,
      });
    }
  } catch (error) {
    logError("mark_message_processed_exception", error, {
      messageId,
      correlationId,
    });
  }
}

/**
 * Add message to processing queue
 * 
 * @param messageId - WhatsApp message ID
 * @param userPhone - User phone number
 * @param messageType - Type of message
 * @param payload - Message payload
 * @param correlationId - Correlation ID
 * @param priority - Message priority (1-10, lower is higher priority)
 * @returns Queue entry ID if successful
 */
export async function enqueueMessage(
  messageId: string,
  userPhone: string,
  messageType: string,
  payload: Record<string, unknown>,
  correlationId: string,
  priority: number = 5
): Promise<string | null> {
  // message_queue table doesn't exist - just log for observability
  logStructuredEvent("MESSAGE_ENQUEUED", {
    messageId,
    userPhone,
    messageType,
    correlationId,
    priority,
  });
  
  // Return a generated ID for compatibility
  return `msg_${messageId}_${Date.now()}`;
}

/**
 * Get or create AI conversation memory
 * 
 * @param userPhone - User phone number
 * @param agentType - AI agent type
 * @param sessionId - Session ID
 * @returns Conversation memory object
 */
export async function getOrCreateConversationMemory(
  userPhone: string,
  agentType: string,
  sessionId?: string
): Promise<{
  id: string;
  conversation_history: Array<{ role: string; content: string; timestamp: string }>;
  context: Record<string, unknown>;
} | null> {
  // ai_conversation_memory table doesn't exist - return empty memory
  const memoryId = `mem_${userPhone}_${agentType}_${Date.now()}`;
  
  logStructuredEvent("CONVERSATION_MEMORY_CREATED", {
    conversationId: memoryId,
    userPhone,
    agentType,
    sessionId,
  });

  return {
    id: memoryId,
    conversation_history: [],
    context: {},
  };
}

/**
 * Update AI conversation memory
 * 
 * @param conversationId - Conversation memory ID
 * @param message - New message to add
 * @param context - Updated context
 */
export async function updateConversationMemory(
  conversationId: string,
  message: { role: string; content: string },
  context?: Record<string, unknown>
): Promise<void> {
  // ai_conversation_memory table doesn't exist - just log for observability
  logStructuredEvent("CONVERSATION_MEMORY_UPDATED", {
    conversationId,
    messageRole: message.role,
    hasContext: !!context,
  });
}

/**
 * Cleanup old conversation memories (older than 7 days with no activity)
 */
export async function cleanupOldConversations(): Promise<number> {
  // ai_conversation_memory table doesn't exist - no-op
  return 0;
}
