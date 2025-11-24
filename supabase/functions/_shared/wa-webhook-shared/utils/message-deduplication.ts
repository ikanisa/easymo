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
    // Check if message exists in processed_webhook_messages
    const { data, error } = await supabase
      .from("processed_webhook_messages")
      .select("id, processed_at")
      .eq("whatsapp_message_id", messageId)
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
        originalProcessedAt: data.processed_at,
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
  conversationId?: string | null,
  payload?: Record<string, unknown>,
  processingTimeMs?: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from("processed_webhook_messages")
      .insert({
        whatsapp_message_id: messageId,
        correlation_id: correlationId,
        conversation_id: conversationId,
        payload: payload || {},
        processing_time_ms: processingTimeMs,
        processed_at: new Date().toISOString(),
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
  try {
    const { data, error } = await supabase
      .from("message_queue")
      .insert({
        message_id: messageId,
        user_phone: userPhone,
        message_type: messageType,
        payload,
        correlation_id: correlationId,
        priority,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("enqueue_message", error, {
        messageId,
        correlationId,
      });
      return null;
    }

    logStructuredEvent("MESSAGE_ENQUEUED", {
      messageId,
      queueId: data.id,
      correlationId,
      priority,
    });

    return data.id;
  } catch (error) {
    logError("enqueue_message_exception", error, {
      messageId,
      correlationId,
    });
    return null;
  }
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
  try {
    // Try to get existing conversation
    const { data: existing, error: fetchError } = await supabase
      .from("ai_conversation_memory")
      .select("*")
      .eq("user_phone", userPhone)
      .eq("agent_type", agentType)
      .order("last_interaction", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      logError("get_conversation_memory", fetchError, {
        userPhone,
        agentType,
      });
    }

    // If exists and recent (within 30 minutes), return it
    if (existing && existing.last_interaction) {
      const lastInteraction = new Date(existing.last_interaction);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      if (lastInteraction > thirtyMinutesAgo) {
        // Update last interaction time
        await supabase
          .from("ai_conversation_memory")
          .update({ last_interaction: new Date().toISOString() })
          .eq("id", existing.id);
        
        return {
          id: existing.id,
          conversation_history: existing.conversation_history || [],
          context: existing.context || {},
        };
      }
    }

    // Create new conversation memory
    const { data: created, error: createError } = await supabase
      .from("ai_conversation_memory")
      .insert({
        user_phone: userPhone,
        agent_type: agentType,
        session_id: sessionId,
        conversation_history: [],
        context: {},
        last_interaction: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (createError) {
      logError("create_conversation_memory", createError, {
        userPhone,
        agentType,
      });
      return null;
    }

    logStructuredEvent("CONVERSATION_MEMORY_CREATED", {
      conversationId: created.id,
      userPhone,
      agentType,
    });

    return {
      id: created.id,
      conversation_history: created.conversation_history || [],
      context: created.context || {},
    };
  } catch (error) {
    logError("conversation_memory_exception", error, {
      userPhone,
      agentType,
    });
    return null;
  }
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
  try {
    // Get current conversation
    const { data: current, error: fetchError } = await supabase
      .from("ai_conversation_memory")
      .select("conversation_history, context")
      .eq("id", conversationId)
      .single();

    if (fetchError) {
      logError("fetch_conversation_for_update", fetchError, {
        conversationId,
      });
      return;
    }

    const history = current.conversation_history || [];
    const newHistory = [
      ...history,
      {
        ...message,
        timestamp: new Date().toISOString(),
      },
    ];

    // Keep only last 20 messages (configurable)
    const trimmedHistory = newHistory.slice(-20);

    const updateData: any = {
      conversation_history: trimmedHistory,
      last_interaction: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (context) {
      updateData.context = {
        ...(current.context || {}),
        ...context,
      };
    }

    const { error: updateError } = await supabase
      .from("ai_conversation_memory")
      .update(updateData)
      .eq("id", conversationId);

    if (updateError) {
      logError("update_conversation_memory", updateError, {
        conversationId,
      });
    } else {
      logStructuredEvent("CONVERSATION_MEMORY_UPDATED", {
        conversationId,
        messageCount: trimmedHistory.length,
      });
    }
  } catch (error) {
    logError("update_conversation_memory_exception", error, {
      conversationId,
    });
  }
}

/**
 * Cleanup old conversation memories (older than 7 days with no activity)
 */
export async function cleanupOldConversations(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("ai_conversation_memory")
      .delete()
      .lt("last_interaction", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .select("id");

    if (error) {
      logError("cleanup_old_conversations", error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      logStructuredEvent("CONVERSATIONS_CLEANED_UP", { count });
    }

    return count;
  } catch (error) {
    logError("cleanup_old_conversations_exception", error);
    return 0;
  }
}
