import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import type { Memory, Message } from '../types/index.js';
import type { OpenAIProvider } from '../llm/openai-provider.js';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
}

export class MemoryManager {
  private redis: Redis;
  private supabase: SupabaseClient;
  private openaiProvider: OpenAIProvider;
  private embeddings: Map<string, { embedding: number[]; metadata: any }> = new Map();

  constructor(config: MemoryConfig, openaiProvider: OpenAIProvider) {
    this.redis = new Redis(config.redis || {
      host: 'localhost',
      port: 6379,
    });
    
    this.openaiProvider = openaiProvider;
    
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  /**
   * Initialize - ensure tables exist
   */
  async initialize(): Promise<void> {
    // Check if ai_memories table exists
    const { error } = await this.supabase
      .from('ai_memories')
      .select('id')
      .limit(1);
    
    if (error && error.message.includes('relation "ai_memories" does not exist')) {
      console.warn('ai_memories table does not exist. Run migrations first.');
    }
  }

  // ========================================================================
  // SHORT-TERM MEMORY (Redis) - Last N messages in conversation
  // ========================================================================

  /**
   * Save message to short-term memory
   */
  async saveShortTerm(
    conversationId: string, 
    message: Message, 
    ttl?: number
  ): Promise<void> {
    const key = `conversation:${conversationId}:messages`;
    const value = JSON.stringify(message);
    
    await this.redis.rpush(key, value);
    
    if (ttl) {
      await this.redis.expire(key, ttl);
    }

    // Maintain sliding window (keep last 50 messages)
    const length = await this.redis.llen(key);
    if (length > 50) {
      await this.redis.ltrim(key, -50, -1);
    }
  }

  /**
   * Get short-term memory
   */
  async getShortTerm(conversationId: string, limit?: number): Promise<Message[]> {
    const key = `conversation:${conversationId}:messages`;
    const messages = await this.redis.lrange(key, -(limit || 20), -1);
    
    return messages.map(msg => JSON.parse(msg));
  }

  /**
   * Clear short-term memory
   */
  async clearShortTerm(conversationId: string): Promise<void> {
    const key = `conversation:${conversationId}:messages`;
    await this.redis.del(key);
  }

  // ========================================================================
  // LONG-TERM MEMORY (Supabase + pgvector) - Important facts and context
  // ========================================================================

  /**
   * Save to long-term memory with OpenAI embeddings
   */
  async saveLongTerm(content: string, metadata: Record<string, any>): Promise<void> {
    try {
      // Generate embedding using OpenAI
      const embedding = await this.openaiProvider.generateEmbedding(
        content,
        'text-embedding-3-small'
      );

      // Store in Supabase with pgvector
      const { error } = await this.supabase
        .from('ai_memories')
        .insert({
          id: uuidv4(),
          content,
          embedding,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
          },
        });

      if (error) {
        console.error('Failed to save to long-term memory:', error);
      }

      // Also cache in memory for faster access
      const cacheKey = `${metadata.conversationId || 'global'}_${Date.now()}`;
      this.embeddings.set(cacheKey, { embedding, metadata: { content, ...metadata } });
      
      // Limit cache size
      if (this.embeddings.size > 1000) {
        const firstKey = this.embeddings.keys().next().value;
        this.embeddings.delete(firstKey);
      }
    } catch (error) {
      console.error('Error saving to long-term memory:', error);
    }
  }

  /**
   * Retrieve relevant memories using semantic search
   */
  async retrieveRelevant(query: string, topK: number = 5): Promise<Memory[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.openaiProvider.generateEmbedding(
        query,
        'text-embedding-3-small'
      );

      // Search using pgvector in Supabase
      const { data, error } = await this.supabase.rpc('match_ai_memories', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: topK
      });

      if (error) {
        console.error('Failed to retrieve memories:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        type: 'long' as const,
        content: item.content,
        embedding: item.embedding,
        metadata: item.metadata,
        createdAt: new Date(item.created_at),
        similarity: item.similarity,
      }));
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return [];
    }
  }

  /**
   * Extract and store important information from conversation
   */
  async extractAndStoreImportant(
    conversationId: string,
    messages: Message[]
  ): Promise<void> {
    if (messages.length === 0) return;

    // Get last few messages
    const recentMessages = messages.slice(-10);
    const conversationText = recentMessages
      .filter(m => m.content)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    // Extract important facts using simple heuristics
    // In production, use OpenAI to extract structured information
    const importantKeywords = [
      'remember', 'important', 'note', 'preference', 'always', 'never',
      'my name is', 'i am', 'i live', 'contact me', 'email', 'phone'
    ];

    const lines = conversationText.toLowerCase().split('\n');
    for (const line of lines) {
      const hasImportantKeyword = importantKeywords.some(kw => line.includes(kw));
      if (hasImportantKeyword && line.length > 20) {
        await this.saveLongTerm(line, {
          conversationId,
          type: 'important_fact',
          source: 'conversation',
        });
      }
    }
  }

  // ========================================================================
  // WORKING MEMORY (Redis) - Temporary agent state
  // ========================================================================

  /**
   * Save working memory (temporary agent state)
   */
  async saveWorkingMemory(
    agentId: string, 
    key: string, 
    value: any, 
    ttl: number = 3600
  ): Promise<void> {
    const redisKey = `agent:${agentId}:working:${key}`;
    await this.redis.setex(redisKey, ttl, JSON.stringify(value));
  }

  /**
   * Get working memory
   */
  async getWorkingMemory(agentId: string, key: string): Promise<any> {
    const redisKey = `agent:${agentId}:working:${key}`;
    const value = await this.redis.get(redisKey);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Clear working memory
   */
  async clearWorkingMemory(agentId: string, key: string): Promise<void> {
    const redisKey = `agent:${agentId}:working:${key}`;
    await this.redis.del(redisKey);
  }

  // ========================================================================
  // CONVERSATION MANAGEMENT
  // ========================================================================

  /**
   * Summarize conversation
   */
  async summarizeConversation(conversationId: string): Promise<string> {
    const messages = await this.getShortTerm(conversationId);
    
    if (messages.length === 0) {
      return '';
    }

    // For now, return simple summary
    // In production, use OpenAI to generate summary
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    return `Conversation with ${userMessages.length} user messages and ${assistantMessages.length} assistant responses.`;
  }

  /**
   * Generate context from memories for agent
   */
  async generateContext(query: string, conversationId?: string): Promise<string> {
    const relevantMemories = await this.retrieveRelevant(query, 5);
    
    if (relevantMemories.length === 0) {
      return '';
    }

    const memoryContext = relevantMemories
      .map(m => `[${m.metadata?.type || 'memory'}] ${m.content}`)
      .join('\n');

    return `Relevant context from memory:\n${memoryContext}`;
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
    this.embeddings.clear();
  }
}
