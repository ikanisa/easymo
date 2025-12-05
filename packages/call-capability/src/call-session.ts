/**
 * Call Session Manager
 * 
 * Manages call lifecycle: creation, status updates, and completion.
 * Provides a clean interface for agents to interact with the calls table.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Call,
  CallChannel,
  CallDirection,
  CallStatus,
  CreateCallInput,
  UpdateCallInput,
} from './types';

export class CallSession {
  private supabase: SupabaseClient;
  private callId: string | null = null;
  private startTime: Date | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Start a new call session
   */
  async start(input: CreateCallInput): Promise<Call> {
    this.startTime = new Date();

    const { data, error } = await this.supabase
      .from('calls')
      .insert({
        user_id: input.user_id,
        agent_id: input.agent_id,
        channel: input.channel,
        direction: input.direction,
        provider_call_id: input.provider_call_id,
        from_number: input.from_number,
        to_number: input.to_number,
        status: 'initiated',
        metadata: input.metadata || {},
        started_at: this.startTime.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create call: ${error.message}`);
    }

    this.callId = data.id;
    return data as Call;
  }

  /**
   * Update call to in_progress status
   */
  async markInProgress(): Promise<void> {
    if (!this.callId) {
      throw new Error('No active call session');
    }

    const { error } = await this.supabase
      .from('calls')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.callId);

    if (error) {
      throw new Error(`Failed to update call status: ${error.message}`);
    }
  }

  /**
   * End the call session
   */
  async end(status: 'completed' | 'abandoned' | 'failed' = 'completed'): Promise<Call> {
    if (!this.callId) {
      throw new Error('No active call session');
    }

    const endTime = new Date();
    const durationSeconds = this.startTime
      ? Math.floor((endTime.getTime() - this.startTime.getTime()) / 1000)
      : null;

    const { data, error } = await this.supabase
      .from('calls')
      .update({
        status,
        ended_at: endTime.toISOString(),
        duration_seconds: durationSeconds,
        updated_at: endTime.toISOString(),
      })
      .eq('id', this.callId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to end call: ${error.message}`);
    }

    return data as Call;
  }

  /**
   * Update call metadata
   */
  async updateMetadata(metadata: Record<string, unknown>): Promise<void> {
    if (!this.callId) {
      throw new Error('No active call session');
    }

    const { error } = await this.supabase.rpc('jsonb_merge_metadata', {
      call_id: this.callId,
      new_metadata: metadata,
    });

    // Fallback to regular update if RPC doesn't exist
    if (error) {
      const { data: existing } = await this.supabase
        .from('calls')
        .select('metadata')
        .eq('id', this.callId)
        .single();

      const { error: updateError } = await this.supabase
        .from('calls')
        .update({
          metadata: { ...(existing?.metadata || {}), ...metadata },
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.callId);

      if (updateError) {
        throw new Error(`Failed to update metadata: ${updateError.message}`);
      }
    }
  }

  /**
   * Get current call ID
   */
  getCallId(): string | null {
    return this.callId;
  }

  /**
   * Get call duration so far (in seconds)
   */
  getCurrentDuration(): number | null {
    if (!this.startTime) return null;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Attach to an existing call (for resumption or external events)
   */
  async attach(callId: string): Promise<Call> {
    const { data, error } = await this.supabase
      .from('calls')
      .select()
      .eq('id', callId)
      .single();

    if (error) {
      throw new Error(`Failed to attach to call: ${error.message}`);
    }

    this.callId = data.id;
    this.startTime = new Date(data.started_at);
    return data as Call;
  }
}

/**
 * Static helpers for call operations
 */
export const CallSessionHelpers = {
  /**
   * Create a call without session management
   */
  async createCall(
    supabase: SupabaseClient,
    input: CreateCallInput
  ): Promise<Call> {
    const { data, error } = await supabase
      .from('calls')
      .insert({
        user_id: input.user_id,
        agent_id: input.agent_id,
        channel: input.channel,
        direction: input.direction,
        provider_call_id: input.provider_call_id,
        from_number: input.from_number,
        to_number: input.to_number,
        status: 'initiated',
        metadata: input.metadata || {},
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create call: ${error.message}`);
    }

    return data as Call;
  },

  /**
   * Get a call by ID
   */
  async getCall(supabase: SupabaseClient, callId: string): Promise<Call | null> {
    const { data, error } = await supabase
      .from('calls')
      .select()
      .eq('id', callId)
      .single();

    if (error) {
      return null;
    }

    return data as Call;
  },

  /**
   * Get a call by provider ID
   */
  async getCallByProviderId(
    supabase: SupabaseClient,
    providerCallId: string
  ): Promise<Call | null> {
    const { data, error } = await supabase
      .from('calls')
      .select()
      .eq('provider_call_id', providerCallId)
      .single();

    if (error) {
      return null;
    }

    return data as Call;
  },

  /**
   * Update call status
   */
  async updateCall(
    supabase: SupabaseClient,
    input: UpdateCallInput
  ): Promise<Call> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status) updates.status = input.status;
    if (input.ended_at) updates.ended_at = input.ended_at;
    if (input.duration_seconds !== undefined) updates.duration_seconds = input.duration_seconds;
    if (input.metadata) updates.metadata = input.metadata;

    const { data, error } = await supabase
      .from('calls')
      .update(updates)
      .eq('id', input.call_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update call: ${error.message}`);
    }

    return data as Call;
  },

  /**
   * Get recent calls for a user
   */
  async getRecentCalls(
    supabase: SupabaseClient,
    userId: string,
    limit: number = 10
  ): Promise<Call[]> {
    const { data, error } = await supabase
      .from('calls')
      .select()
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent calls: ${error.message}`);
    }

    return data as Call[];
  },

  /**
   * Get calls for an agent
   */
  async getAgentCalls(
    supabase: SupabaseClient,
    agentId: string,
    options?: {
      status?: CallStatus;
      limit?: number;
      since?: Date;
    }
  ): Promise<Call[]> {
    let query = supabase
      .from('calls')
      .select()
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.since) {
      query = query.gte('started_at', options.since.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get agent calls: ${error.message}`);
    }

    return data as Call[];
  },
};

export default CallSession;
