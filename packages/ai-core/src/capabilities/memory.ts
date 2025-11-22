import { SupabaseClient } from '@supabase/supabase-js';

import { Message } from '../base/types';

export interface MemoryConfig {
  enabled: boolean;
  maxContextLength: number;
  vectorStore?: 'supabase' | 'none';
}

/**
 * Memory Manager
 * Handles conversation history and long-term memory
 */
export class MemoryManager {
  private supabase?: SupabaseClient;
  private config: MemoryConfig;
  private conversationCache: Map<string, Message[]> = new Map();

  constructor(supabase: SupabaseClient | undefined, config: MemoryConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * Load conversation history for a user
   */
  async load(userId: string): Promise<Message[]> {
    if (!this.config.enabled) return [];

    // Check cache first
    if (this.conversationCache.has(userId)) {
      return this.conversationCache.get(userId)!;
    }

    // Load from database
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('conversation_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true })
        .limit(this.config.maxContextLength);

      if (!error && data) {
        const messages: Message[] = data.map(row => ({
          role: row.role,
          content: row.content,
          timestamp: new Date(row.timestamp)
        }));
        
        this.conversationCache.set(userId, messages);
        return messages;
      }
    }

    return [];
  }

  /**
   * Save conversation message
   */
  async save(userId: string, message: Message): Promise<void> {
    if (!this.config.enabled) return;

    // Update cache
    const history = this.conversationCache.get(userId) || [];
    history.push(message);
    
    // Keep only last N messages
    if (history.length > this.config.maxContextLength) {
      history.shift();
    }
    
    this.conversationCache.set(userId, history);

    // Save to database
    if (this.supabase) {
      await this.supabase.from('conversation_history').insert({
        user_id: userId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp
      });
    }
  }

  /**
   * Clear conversation history
   */
  async clear(userId: string): Promise<void> {
    this.conversationCache.delete(userId);

    if (this.supabase) {
      await this.supabase
        .from('conversation_history')
        .delete()
        .eq('user_id', userId);
    }
  }

  /**
   * Search conversation history semantically
   */
  async search(userId: string, query: string, limit: number = 5): Promise<Message[]> {
    if (!this.config.enabled || !this.supabase || this.config.vectorStore !== 'supabase') {
      return [];
    }

    // Generate embedding for query
    const openai = require('openai');
    const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const embedding = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    });

    const queryEmbedding = embedding.data[0].embedding;

    // Search using vector similarity
    const { data, error } = await this.supabase.rpc('search_conversation_history', {
      user_id: userId,
      query_embedding: queryEmbedding,
      match_count: limit
    });

    if (error || !data) return [];

    return data.map((row: any) => ({
      role: row.role,
      content: row.content,
      timestamp: new Date(row.timestamp)
    }));
  }

  /**
   * Get summary of conversation
   */
  async getSummary(userId: string): Promise<string> {
    const history = await this.load(userId);
    
    if (history.length === 0) {
      return 'No conversation history';
    }

    // Use LLM to summarize
    const openai = require('openai');
    const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize this conversation concisely, highlighting key points and decisions.'
        },
        ...messages
      ],
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || 'Unable to generate summary';
  }
}
