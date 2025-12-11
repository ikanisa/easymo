/**
 * Session Manager
 * Manages AI agent sessions and context
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Session } from './base-agent.ts';

export class SessionManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get existing session or create new one
   */
  async getOrCreate(phone: string): Promise<Session> {
    // Try to get existing active session
    const { data: existingSession } = await this.supabase
      .from('ai_agent_sessions')
      .select('*')
      .eq('phone', phone)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingSession) {
      return this.mapToSession(existingSession);
    }

    // Create new session
    const { data: newSession, error } = await this.supabase
      .from('ai_agent_sessions')
      .insert({
        phone,
        context: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select()
      .single();

    if (error || !newSession) {
      throw new Error(`Failed to create session: ${error?.message}`);
    }

    return this.mapToSession(newSession);
  }

  /**
   * Update session context
   */
  async updateContext(
    sessionId: string,
    context: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ai_agent_sessions')
      .update({
        context,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to update session context: ${error.message}`);
    }
  }

  /**
   * Set current agent for session
   */
  async setCurrentAgent(sessionId: string, agentType: string): Promise<void> {
    const { data: session } = await this.supabase
      .from('ai_agent_sessions')
      .select('context')
      .eq('id', sessionId)
      .single();

    const context = session?.context || {};
    context.currentAgent = agentType;

    await this.updateContext(sessionId, context);
  }

  /**
   * Clear current agent (back to home menu)
   */
  async clearCurrentAgent(sessionId: string): Promise<void> {
    const { data: session } = await this.supabase
      .from('ai_agent_sessions')
      .select('context')
      .eq('id', sessionId)
      .single();

    const context = session?.context || {};
    delete context.currentAgent;

    await this.updateContext(sessionId, context);
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_agent_sessions')
      .update({
        expires_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to end session: ${error.message}`);
    }
  }

  /**
   * Map database row to Session interface
   */
  private mapToSession(row: any): Session {
    return {
      id: row.id,
      phone: row.phone,
      context: row.context || {},
      currentAgent: row.context?.currentAgent,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
