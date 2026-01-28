/**
 * Transcript Logger
 * 
 * Manages transcript chunks during calls.
 * Supports streaming insertion and retrieval.
 */

import { SupabaseClient } from '@supabase/supabase-js';

import {
  AddTranscriptInput,
  TranscriptChunk,
  TranscriptRole,
} from './types';

export class TranscriptLogger {
  private supabase: SupabaseClient;
  private callId: string;
  private currentSeq: number = 0;
  private buffer: TranscriptChunk[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private flushThreshold: number;

  constructor(
    supabase: SupabaseClient,
    callId: string,
    options?: {
      flushThreshold?: number;
      autoFlushMs?: number;
    }
  ) {
    this.supabase = supabase;
    this.callId = callId;
    this.flushThreshold = options?.flushThreshold ?? 5;

    // Set up auto-flush if specified
    if (options?.autoFlushMs) {
      this.flushInterval = setInterval(() => {
        this.flush().catch(console.error);
      }, options.autoFlushMs);
    }
  }

  /**
   * Add a transcript chunk
   * Buffers chunks and flushes when threshold is reached
   */
  async add(input: Omit<AddTranscriptInput, 'call_id'>): Promise<void> {
    this.currentSeq++;

    const chunk: TranscriptChunk = {
      call_id: this.callId,
      seq: this.currentSeq,
      role: input.role,
      text: input.text,
      confidence: input.confidence,
      started_at: input.started_at || new Date().toISOString(),
      ended_at: input.ended_at,
      raw: input.raw,
    };

    this.buffer.push(chunk);

    if (this.buffer.length >= this.flushThreshold) {
      await this.flush();
    }
  }

  /**
   * Add a user message
   */
  async addUserMessage(text: string, confidence?: number): Promise<void> {
    await this.add({ role: 'user', text, confidence });
  }

  /**
   * Add an assistant (agent) message
   */
  async addAssistantMessage(text: string): Promise<void> {
    await this.add({ role: 'assistant', text });
  }

  /**
   * Add a system message (e.g., tool calls, events)
   */
  async addSystemMessage(text: string, raw?: Record<string, unknown>): Promise<void> {
    await this.add({ role: 'system', text, raw });
  }

  /**
   * Flush buffered chunks to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const chunksToInsert = [...this.buffer];
    this.buffer = [];

    const { error } = await this.supabase
      .from('call_transcripts')
      .insert(chunksToInsert);

    if (error) {
      // Re-add to buffer on failure
      this.buffer = [...chunksToInsert, ...this.buffer];
      throw new Error(`Failed to flush transcripts: ${error.message}`);
    }
  }

  /**
   * Stop auto-flush and flush remaining buffer
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }

  /**
   * Get current sequence number
   */
  getCurrentSeq(): number {
    return this.currentSeq;
  }

  /**
   * Get buffered chunks count
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * Static helpers for transcript operations
 */
export const TranscriptHelpers = {
  /**
   * Get all transcripts for a call
   */
  async getTranscripts(
    supabase: SupabaseClient,
    callId: string
  ): Promise<TranscriptChunk[]> {
    const { data, error } = await supabase
      .from('call_transcripts')
      .select()
      .eq('call_id', callId)
      .order('seq', { ascending: true });

    if (error) {
      throw new Error(`Failed to get transcripts: ${error.message}`);
    }

    return data as TranscriptChunk[];
  },

  /**
   * Get full transcript as text
   */
  async getTranscriptText(
    supabase: SupabaseClient,
    callId: string,
    options?: {
      includeRoles?: boolean;
      roleLabels?: { user?: string; assistant?: string; system?: string };
    }
  ): Promise<string> {
    const chunks = await this.getTranscripts(supabase, callId);
    
    const roleLabels = options?.roleLabels || {
      user: 'User',
      assistant: 'Agent',
      system: 'System',
    };

    if (options?.includeRoles) {
      return chunks
        .map((c) => `${roleLabels[c.role] || c.role}: ${c.text}`)
        .join('\n');
    }

    return chunks.map((c) => c.text).join('\n');
  },

  /**
   * Get transcript statistics
   */
  async getTranscriptStats(
    supabase: SupabaseClient,
    callId: string
  ): Promise<{
    totalChunks: number;
    userChunks: number;
    assistantChunks: number;
    systemChunks: number;
    totalWords: number;
    avgConfidence: number | null;
  }> {
    const chunks = await this.getTranscripts(supabase, callId);

    const stats = {
      totalChunks: chunks.length,
      userChunks: 0,
      assistantChunks: 0,
      systemChunks: 0,
      totalWords: 0,
      avgConfidence: null as number | null,
    };

    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const chunk of chunks) {
      if (chunk.role === 'user') stats.userChunks++;
      else if (chunk.role === 'assistant') stats.assistantChunks++;
      else if (chunk.role === 'system') stats.systemChunks++;

      stats.totalWords += chunk.text.split(/\s+/).filter(Boolean).length;

      if (chunk.confidence !== undefined && chunk.confidence !== null) {
        confidenceSum += chunk.confidence;
        confidenceCount++;
      }
    }

    if (confidenceCount > 0) {
      stats.avgConfidence = confidenceSum / confidenceCount;
    }

    return stats;
  },

  /**
   * Insert a single transcript chunk directly
   */
  async insertChunk(
    supabase: SupabaseClient,
    input: AddTranscriptInput
  ): Promise<TranscriptChunk> {
    // Get next sequence number
    const { data: lastChunk } = await supabase
      .from('call_transcripts')
      .select('seq')
      .eq('call_id', input.call_id)
      .order('seq', { ascending: false })
      .limit(1)
      .single();

    const nextSeq = (lastChunk?.seq || 0) + 1;

    const { data, error } = await supabase
      .from('call_transcripts')
      .insert({
        call_id: input.call_id,
        seq: nextSeq,
        role: input.role,
        text: input.text,
        confidence: input.confidence,
        started_at: input.started_at || new Date().toISOString(),
        ended_at: input.ended_at,
        raw: input.raw,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert transcript: ${error.message}`);
    }

    return data as TranscriptChunk;
  },

  /**
   * Delete all transcripts for a call
   */
  async deleteTranscripts(
    supabase: SupabaseClient,
    callId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('call_transcripts')
      .delete()
      .eq('call_id', callId);

    if (error) {
      throw new Error(`Failed to delete transcripts: ${error.message}`);
    }
  },
};

export default TranscriptLogger;
