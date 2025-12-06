/**
 * Memory Manager for AI Agents
 *
 * Manages conversation memory using:
 * - Short-term: Recent messages from wa_interactions table
 * - Working memory: Session state
 * - Long-term: Important facts stored in agent_conversations
 * 
 * ENHANCED: Added caching layer for performance optimization
 */

import type { SupabaseClient } from "../deps.ts";
import { logStructuredEvent } from "../observe/log.ts";
import type { ChatMessage } from "./openai_client.ts";
import { CacheManager } from "./cache.ts";
import { getConfig } from "./config_manager.ts";

/**
 * Safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface MemoryEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  summary: string;
  keyFacts: string[];
  totalMessages: number;
  startedAt: string;
}

export class MemoryManager {
  private cache: CacheManager;
  
  constructor(private supabase: SupabaseClient) {
    const config = getConfig();
    this.cache = new CacheManager({
      defaultTTL: config.cacheTTL,
      maxSize: config.cacheMaxSize,
      checkPeriod: 600, // 10 minutes
    });
  }

  /**
   * Get recent conversation history for a user
   * ENHANCED: Added caching layer
   */
  async getConversationHistory(
    phoneNumber: string,
    limit: number = 20,
    correlationId?: string,
  ): Promise<ChatMessage[]> {
    const config = getConfig();
    
    // Try cache first if enabled
    if (config.memoryCacheEnabled) {
      const cacheKey = `history:${phoneNumber}:${limit}`;
      const cached = this.cache.get<ChatMessage[]>(cacheKey);
      if (cached) {
        await logStructuredEvent("MEMORY_CACHE_HIT", {
          phone_number: phoneNumber,
          correlation_id: correlationId,
        });
        return cached;
      }
    }
    
    try {
      const { data, error } = await this.supabase
        .from("wa_interactions")
        .select(
          "message_type, message_content, response_content, created_at, metadata",
        )
        .eq("phone_number", phoneNumber)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      const messages: ChatMessage[] = [];

      // Process in chronological order
      for (const interaction of data.reverse()) {
        // Add user message
        const userContent = this.extractMessageContent(
          interaction.message_content,
        );
        if (userContent) {
          messages.push({
            role: "user",
            content: userContent,
          });
        }

        // Add assistant response
        const assistantContent = this.extractResponseContent(
          interaction.response_content,
        );
        if (assistantContent) {
          messages.push({
            role: "assistant",
            content: assistantContent,
          });
        }
      }

      // Cache the result if enabled
      if (config.memoryCacheEnabled) {
        const cacheKey = `history:${phoneNumber}:${limit}`;
        this.cache.set(cacheKey, messages, config.cacheTTL);
      }

      await logStructuredEvent("MEMORY_HISTORY_RETRIEVED", {
        correlation_id: correlationId,
        phone_number: phoneNumber,
        message_count: messages.length,
      });

      return messages;
    } catch (error) {
      await logStructuredEvent("MEMORY_HISTORY_ERROR", {
        correlation_id: correlationId,
        phone_number: phoneNumber,
        error: getErrorMessage(error),
      });
      return [];
    }
  }

  /**
   * Save important information to long-term memory with embeddings
   */
  async saveLongTermMemory(
    content: string,
    metadata: Record<string, any>,
    correlationId?: string
  ): Promise<void> {
    try {
      const { getOpenAIClient } = await import("./openai_client.ts");
      const openai = getOpenAIClient();

      // Generate embedding
      const embedding = await openai.generateEmbedding(
        content,
        "text-embedding-3-small",
        correlationId
      );

      // Calculate importance score (simple heuristic, can be enhanced)
      const importanceScore = this.calculateImportanceScore(content);

      // Store in agent_embeddings table
      const { error } = await this.supabase
        .from("agent_embeddings")
        .insert({
          content,
          embedding,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
          },
          importance_score: importanceScore,
        });

      if (error) {
        throw error;
      }

      await logStructuredEvent("MEMORY_LONG_TERM_SAVED", {
        correlation_id: correlationId,
        content_length: content.length,
        importance_score: importanceScore,
      });
    } catch (error) {
      await logStructuredEvent("MEMORY_LONG_TERM_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Retrieve relevant memories using semantic search
   */
  async retrieveRelevantMemories(
    query: string,
    limit: number = 5,
    threshold: number = 0.7,
    correlationId?: string
  ): Promise<Array<{ content: string; metadata: any; similarity: number }>> {
    try {
      const { getOpenAIClient } = await import("./openai_client.ts");
      const openai = getOpenAIClient();

      // Generate query embedding
      const queryEmbedding = await openai.generateEmbedding(
        query,
        "text-embedding-3-small",
        correlationId
      );

      // Search using pgvector similarity
      const { data, error } = await this.supabase.rpc("match_agent_embeddings", {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        throw error;
      }

      const memories = (data || []).map((item: any) => ({
        content: item.content,
        metadata: item.metadata,
        similarity: item.similarity,
      }));

      await logStructuredEvent("MEMORY_RELEVANT_RETRIEVED", {
        correlation_id: correlationId,
        query_length: query.length,
        memories_found: memories.length,
      });

      return memories;
    } catch (error) {
      await logStructuredEvent("MEMORY_RELEVANT_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
      return [];
    }
  }

  /**
   * Calculate importance score for content
   */
  private calculateImportanceScore(content: string): number {
    let score = 0.5; // Base score

    // Increase score for important keywords
    const importantKeywords = [
      "important",
      "remember",
      "note",
      "critical",
      "urgent",
      "booking",
      "payment",
      "transfer",
      "confirmed",
      "scheduled",
    ];

    const lowerContent = content.toLowerCase();
    for (const keyword of importantKeywords) {
      if (lowerContent.includes(keyword)) {
        score += 0.1;
      }
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Summarize conversation using OpenAI
   */
  async summarizeConversation(
    phoneNumber: string,
    correlationId?: string
  ): Promise<string> {
    try {
      const messages = await this.getConversationHistory(
        phoneNumber,
        20,
        correlationId
      );

      if (messages.length === 0) {
        return "";
      }

      const conversationText = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      const { getOpenAIClient } = await import("./openai_client.ts");
      const openai = getOpenAIClient();

      const response = await openai.createChatCompletion(
        {
          model: "gpt-5"  // Per README.md: Mandatory GPT-5,
          messages: [
            {
              role: "system",
              content:
                "Summarize the following conversation concisely, capturing key points, decisions, and action items. Keep it under 100 words.",
            },
            {
              role: "user",
              content: conversationText,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        },
        correlationId
      );

      const summary = response.text || "";

      await logStructuredEvent("MEMORY_CONVERSATION_SUMMARIZED", {
        correlation_id: correlationId,
        phone_number: phoneNumber,
        message_count: messages.length,
        summary_length: summary.length,
      });

      return summary;
    } catch (error) {
      await logStructuredEvent("MEMORY_SUMMARIZE_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
      return [];
    }
  }

  /**
   * Save message interaction to memory
   */
  async saveInteraction(
    phoneNumber: string,
    userId: string | undefined,
    userMessage: string,
    assistantResponse: string,
    metadata?: Record<string, any>,
    correlationId?: string,
  ): Promise<void> {
    try {
      await this.supabase.from("wa_interactions").insert({
        phone_number: phoneNumber,
        user_id: userId,
        message_type: "ai_agent",
        message_content: { text: { body: userMessage } },
        response_content: { text: { body: assistantResponse } },
        correlation_id: correlationId,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      });

      await logStructuredEvent("MEMORY_INTERACTION_SAVED", {
        correlation_id: correlationId,
        phone_number: phoneNumber,
      });
    } catch (error) {
      await logStructuredEvent("MEMORY_SAVE_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Store important facts in agent_conversations for long-term memory
   */
  async saveLongTermMemory(
    userId: string,
    phoneNumber: string,
    sessionId: string,
    content: string,
    metadata?: Record<string, any>,
    correlationId?: string,
  ): Promise<void> {
    try {
      await this.supabase.from("agent_conversations").insert({
        session_id: sessionId,
        role: "system",
        content,
        metadata: {
          phone_number: phoneNumber,
          type: "long_term_memory",
          ...metadata,
        },
        created_at: new Date().toISOString(),
      });

      await logStructuredEvent("MEMORY_LONGTERM_SAVED", {
        correlation_id: correlationId,
        session_id: sessionId,
      });
    } catch (error) {
      await logStructuredEvent("MEMORY_LONGTERM_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Get conversation summary for a user
   */
  async getConversationSummary(
    phoneNumber: string,
    correlationId?: string,
  ): Promise<ConversationSummary | null> {
    try {
      const { data, error } = await this.supabase
        .from("wa_interactions")
        .select("created_at, metadata")
        .eq("phone_number", phoneNumber)
        .eq("message_type", "ai_agent")
        .order("created_at", { ascending: true });

      if (error || !data || data.length === 0) {
        return null;
      }

      // Extract key facts from metadata
      const keyFacts: string[] = [];
      for (const interaction of data) {
        if (interaction.metadata?.key_facts) {
          keyFacts.push(...interaction.metadata.key_facts);
        }
      }

      return {
        summary: `User has ${data.length} AI interactions`,
        keyFacts: [...new Set(keyFacts)], // Remove duplicates
        totalMessages: data.length,
        startedAt: data[0].created_at,
      };
    } catch (error) {
      await logStructuredEvent("MEMORY_SUMMARY_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
      return null;
    }
  }

  /**
   * Clear old conversation history (privacy/GDPR)
   */
  async clearOldHistory(
    phoneNumber: string,
    olderThanDays: number = 90,
    correlationId?: string,
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error, count } = await this.supabase
        .from("wa_interactions")
        .delete()
        .eq("phone_number", phoneNumber)
        .lt("created_at", cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      await logStructuredEvent("MEMORY_CLEARED", {
        correlation_id: correlationId,
        phone_number: phoneNumber,
        records_deleted: count || 0,
      });

      return count || 0;
    } catch (error) {
      await logStructuredEvent("MEMORY_CLEAR_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
      return 0;
    }
  }

  /**
   * Extract message content from various formats
   */
  /**
   * Extract important information from conversation
   */
  async extractImportantInfo(
    messages: ChatMessage[],
    correlationId?: string
  ): Promise<{
    facts: string[];
    preferences: string[];
    decisions: string[];
  }> {
    try {
      if (messages.length === 0) {
        return { facts: [], preferences: [], decisions: [] };
      }

      const conversationText = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      const { getOpenAIClient } = await import("./openai_client.ts");
      const openai = getOpenAIClient();

      const extractionPrompt = `Analyze this conversation and extract:
1. Important facts (specific information about the user or their situation)
2. User preferences (what they like, dislike, or prefer)
3. Decisions made (conclusions or actions agreed upon)

Conversation:
${conversationText}

Return in JSON format: {"facts": [], "preferences": [], "decisions": []}`;

      const response = await openai.createChatCompletion(
        {
          model: "gpt-5"  // Per README.md: Mandatory GPT-5,
          messages: [
            {
              role: "system",
              content:
                "You are an information extraction assistant. Extract key information accurately.",
            },
            {
              role: "user",
              content: extractionPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        correlationId
      );

      const extracted = JSON.parse(response.text || "{}");

      return {
        facts: Array.isArray(extracted.facts) ? extracted.facts : [],
        preferences: Array.isArray(extracted.preferences)
          ? extracted.preferences
          : [],
        decisions: Array.isArray(extracted.decisions)
          ? extracted.decisions
          : [],
      };
    } catch (error) {
      await logStructuredEvent("MEMORY_EXTRACT_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
      return { facts: [], preferences: [], decisions: [] };
    }
  }

  /**
   * Clear old conversation history (privacy/GDPR)
   */
  async clearOldHistory(
    phoneNumber: string,
    olderThanDays: number = 90,
    correlationId?: string
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error, count } = await this.supabase
        .from("wa_interactions")
        .delete()
        .eq("phone_number", phoneNumber)
        .lt("created_at", cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      await logStructuredEvent("MEMORY_CLEARED", {
        correlation_id: correlationId,
        phone_number: phoneNumber,
        records_deleted: count || 0,
      });

      return count || 0;
    } catch (error) {
      await logStructuredEvent("MEMORY_CLEAR_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
      return 0;
    }
  }

  /**
   * Extract message content from various formats
   */
  private extractMessageContent(messageContent: any): string {
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
   * Extract response content from various formats
   */
  private extractResponseContent(responseContent: any): string {
    if (typeof responseContent === "string") {
      return responseContent;
    }

    if (responseContent?.text?.body) {
      return responseContent.text.body;
    }

    return "";
  }

  /**
   * Build context string from recent messages
   */
  buildContextString(
    messages: ChatMessage[],
    maxLength: number = 1000,
  ): string {
    let context = "";
    const relevantMessages = messages.slice(-10); // Last 10 messages

    for (const msg of relevantMessages) {
      const line = `${
        msg.role === "user" ? "User" : "Assistant"
      }: ${msg.content}\n`;
      if (context.length + line.length > maxLength) {
        break;
      }
      context += line;
    }

    return context.trim();
  }
}

/**
 * Create memory manager instance
 */
export function createMemoryManager(supabase: SupabaseClient): MemoryManager {
  return new MemoryManager(supabase);
}
