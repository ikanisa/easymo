/**
 * Call Summarizer
 * 
 * Generates and stores call summaries with structured entity extraction.
 * Integrates with AI agents for intelligent summarization.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  CallSentiment,
  CallSummary,
  NextAction,
  SaveSummaryInput,
  TranscriptChunk,
} from './types';
import { TranscriptHelpers } from './transcript-logger';

/**
 * Configuration for the summarizer
 */
export interface SummarizerConfig {
  /** Maximum transcript length to process (in characters) */
  maxTranscriptLength?: number;
  /** Default language if not detected */
  defaultLanguage?: string;
  /** Whether to extract entities automatically */
  autoExtractEntities?: boolean;
}

/**
 * Entity extraction result
 */
export interface ExtractedEntities {
  language: string;
  mainIntent: string;
  sentiment: CallSentiment;
  entities: Record<string, unknown>;
  nextActions: NextAction[];
}

/**
 * Summarizer callback for AI integration
 */
export type SummarizerCallback = (
  transcript: string,
  context: { callId: string; agentId?: string }
) => Promise<{
  summary: string;
  entities?: Record<string, unknown>;
  intent?: string;
  sentiment?: CallSentiment;
  nextActions?: NextAction[];
}>;

export class CallSummarizer {
  private supabase: SupabaseClient;
  private config: SummarizerConfig;
  private summarizerCallback?: SummarizerCallback;

  constructor(
    supabase: SupabaseClient,
    config?: SummarizerConfig,
    summarizerCallback?: SummarizerCallback
  ) {
    this.supabase = supabase;
    this.config = {
      maxTranscriptLength: 50000,
      defaultLanguage: 'rw',
      autoExtractEntities: true,
      ...config,
    };
    this.summarizerCallback = summarizerCallback;
  }

  /**
   * Generate and save a summary for a call
   */
  async summarize(callId: string): Promise<CallSummary> {
    // Get transcript
    const transcript = await TranscriptHelpers.getTranscriptText(
      this.supabase,
      callId,
      { includeRoles: true }
    );

    // Get call metadata
    const { data: call } = await this.supabase
      .from('calls')
      .select('agent_id, duration_seconds')
      .eq('id', callId)
      .single();

    let summary: string;
    let entities: Record<string, unknown> = {};
    let intent: string | undefined;
    let sentiment: CallSentiment | undefined;
    let nextActions: NextAction[] = [];

    // Use callback if provided
    if (this.summarizerCallback) {
      const result = await this.summarizerCallback(
        transcript.slice(0, this.config.maxTranscriptLength),
        { callId, agentId: call?.agent_id }
      );
      summary = result.summary;
      entities = result.entities || {};
      intent = result.intent;
      sentiment = result.sentiment;
      nextActions = result.nextActions || [];
    } else {
      // Fallback to basic summary
      summary = this.generateBasicSummary(transcript);
      
      if (this.config.autoExtractEntities) {
        const extracted = this.extractBasicEntities(transcript);
        entities = extracted.entities;
        intent = extracted.mainIntent;
        sentiment = extracted.sentiment;
      }
    }

    // Get word count
    const stats = await TranscriptHelpers.getTranscriptStats(this.supabase, callId);

    // Save summary
    const callSummary = await this.save({
      call_id: callId,
      summary,
      language: this.detectLanguage(transcript),
      main_intent: intent,
      sentiment,
      entities,
      next_actions: nextActions,
    });

    return callSummary;
  }

  /**
   * Save a summary directly
   */
  async save(input: SaveSummaryInput): Promise<CallSummary> {
    // Get word count and duration from call
    const { data: call } = await this.supabase
      .from('calls')
      .select('duration_seconds')
      .eq('id', input.call_id)
      .single();

    const stats = await TranscriptHelpers.getTranscriptStats(this.supabase, input.call_id);

    const { data, error } = await this.supabase
      .from('call_summaries')
      .upsert({
        call_id: input.call_id,
        summary: input.summary,
        language: input.language || this.config.defaultLanguage,
        main_intent: input.main_intent,
        sentiment: input.sentiment,
        entities: input.entities || {},
        next_actions: input.next_actions || [],
        duration_seconds: call?.duration_seconds,
        word_count: stats.totalWords,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save summary: ${error.message}`);
    }

    return data as CallSummary;
  }

  /**
   * Generate a basic summary without AI
   */
  private generateBasicSummary(transcript: string): string {
    const lines = transcript.split('\n').filter(Boolean);
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    
    // Get first few exchanges
    const firstExchanges = lines.slice(0, 4).join(' ');
    
    return `Call with ${lines.length} exchanges and ${wordCount} words. Started with: "${firstExchanges.slice(0, 200)}..."`;
  }

  /**
   * Extract basic entities without AI
   */
  private extractBasicEntities(transcript: string): ExtractedEntities {
    const lowerText = transcript.toLowerCase();

    // Basic intent detection
    let mainIntent = 'general_inquiry';
    if (lowerText.includes('job') || lowerText.includes('work') || lowerText.includes('employ')) {
      mainIntent = 'job_inquiry';
    } else if (lowerText.includes('farm') || lowerText.includes('produce') || lowerText.includes('crop')) {
      mainIntent = 'farmer_inquiry';
    } else if (lowerText.includes('house') || lowerText.includes('apartment') || lowerText.includes('rent')) {
      mainIntent = 'property_inquiry';
    } else if (lowerText.includes('buy') || lowerText.includes('sell') || lowerText.includes('price')) {
      mainIntent = 'sales_inquiry';
    }

    // Basic sentiment detection
    let sentiment: CallSentiment = 'neutral';
    const positiveWords = ['thank', 'great', 'good', 'excellent', 'happy', 'pleased'];
    const negativeWords = ['bad', 'problem', 'issue', 'frustrated', 'angry', 'unhappy'];
    
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
    
    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';
    else if (positiveCount > 0 && negativeCount > 0) sentiment = 'mixed';

    return {
      language: this.detectLanguage(transcript),
      mainIntent,
      sentiment,
      entities: {},
      nextActions: [],
    };
  }

  /**
   * Basic language detection
   */
  private detectLanguage(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Kinyarwanda indicators
    const rwWords = ['muraho', 'mwaramutse', 'mwiriwe', 'yego', 'oya', 'ndashaka', 'nibyo'];
    // Swahili indicators
    const swWords = ['habari', 'asante', 'karibu', 'ndio', 'hapana', 'sawa'];
    // French indicators
    const frWords = ['bonjour', 'merci', 'oui', 'non', 'je veux', 'maison'];
    
    const rwCount = rwWords.filter(w => lowerText.includes(w)).length;
    const swCount = swWords.filter(w => lowerText.includes(w)).length;
    const frCount = frWords.filter(w => lowerText.includes(w)).length;
    
    if (rwCount > swCount && rwCount > frCount) return 'rw';
    if (swCount > rwCount && swCount > frCount) return 'sw';
    if (frCount > rwCount && frCount > swCount) return 'fr';
    
    return 'en'; // Default to English
  }
}

/**
 * Static helpers for summary operations
 */
export const SummaryHelpers = {
  /**
   * Get summary for a call
   */
  async getSummary(
    supabase: SupabaseClient,
    callId: string
  ): Promise<CallSummary | null> {
    const { data, error } = await supabase
      .from('call_summaries')
      .select()
      .eq('call_id', callId)
      .single();

    if (error) {
      return null;
    }

    return data as CallSummary;
  },

  /**
   * Get summaries for multiple calls
   */
  async getSummaries(
    supabase: SupabaseClient,
    callIds: string[]
  ): Promise<CallSummary[]> {
    const { data, error } = await supabase
      .from('call_summaries')
      .select()
      .in('call_id', callIds);

    if (error) {
      throw new Error(`Failed to get summaries: ${error.message}`);
    }

    return data as CallSummary[];
  },

  /**
   * Update entities in a summary
   */
  async updateEntities(
    supabase: SupabaseClient,
    callId: string,
    entities: Record<string, unknown>
  ): Promise<CallSummary> {
    const { data, error } = await supabase
      .from('call_summaries')
      .update({
        entities,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', callId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update entities: ${error.message}`);
    }

    return data as CallSummary;
  },

  /**
   * Add next actions to a summary
   */
  async addNextActions(
    supabase: SupabaseClient,
    callId: string,
    actions: NextAction[]
  ): Promise<CallSummary> {
    // Get existing actions
    const { data: existing } = await supabase
      .from('call_summaries')
      .select('next_actions')
      .eq('call_id', callId)
      .single();

    const currentActions = (existing?.next_actions || []) as NextAction[];

    const { data, error } = await supabase
      .from('call_summaries')
      .update({
        next_actions: [...currentActions, ...actions],
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', callId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add next actions: ${error.message}`);
    }

    return data as CallSummary;
  },

  /**
   * Delete summary for a call
   */
  async deleteSummary(
    supabase: SupabaseClient,
    callId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('call_summaries')
      .delete()
      .eq('call_id', callId);

    if (error) {
      throw new Error(`Failed to delete summary: ${error.message}`);
    }
  },
};

export default CallSummarizer;
