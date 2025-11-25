/**
 * Session Manager
 * 
 * Manages unified session lifecycle:
 * - Load/create sessions from database
 * - Update session state
 * - Save sessions back to database
 * - Handle session expiration
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { UnifiedSession, AgentType } from "./types.ts";

export class SessionManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get or create a session for a user
   */
  async getOrCreateSession(userPhone: string): Promise<UnifiedSession> {
    // Try to find existing active session
    const { data: existing } = await this.supabase
      .from("unified_sessions")
      .select("*")
      .eq("user_phone", userPhone)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("last_message_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Update last_message_at
      await this.supabase
        .from("unified_sessions")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", existing.id);

      return this.mapFromDatabase(existing);
    }

    // Create new session
    const newSession: Partial<UnifiedSession> = {
      userPhone,
      currentAgent: "support", // Default to support agent
      collectedData: {},
      conversationHistory: [],
      status: "active",
      lastMessageAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    const { data: created } = await this.supabase
      .from("unified_sessions")
      .insert({
        user_phone: newSession.userPhone,
        current_agent: newSession.currentAgent,
        collected_data: newSession.collectedData,
        conversation_history: newSession.conversationHistory,
        status: newSession.status,
        last_message_at: newSession.lastMessageAt,
        expires_at: newSession.expiresAt,
      })
      .select()
      .single();

    return this.mapFromDatabase(created!);
  }

  /**
   * Save session to database
   */
  async saveSession(session: UnifiedSession): Promise<void> {
    await this.supabase
      .from("unified_sessions")
      .update({
        user_id: session.userId,
        current_agent: session.currentAgent,
        active_flow: session.activeFlow,
        flow_step: session.flowStep,
        collected_data: session.collectedData,
        conversation_history: session.conversationHistory,
        location: session.location,
        status: session.status,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", session.id);
  }

  /**
   * Add message to session conversation history
   */
  async addMessage(
    session: UnifiedSession,
    role: "user" | "assistant" | "system",
    content: string
  ): Promise<void> {
    session.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 20 messages to avoid bloat
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }

    session.lastMessageAt = new Date().toISOString();
  }

  /**
   * Clear session flow state
   */
  clearFlow(session: UnifiedSession): void {
    session.activeFlow = undefined;
    session.flowStep = undefined;
    session.collectedData = {};
  }

  /**
   * Expire session
   */
  async expireSession(sessionId: string): Promise<void> {
    await this.supabase
      .from("unified_sessions")
      .update({ status: "expired" })
      .eq("id", sessionId);
  }

  /**
   * Map database row to UnifiedSession
   */
  private mapFromDatabase(row: any): UnifiedSession {
    return {
      id: row.id,
      userPhone: row.user_phone,
      userId: row.user_id,
      currentAgent: row.current_agent as AgentType,
      activeFlow: row.active_flow,
      flowStep: row.flow_step,
      collectedData: row.collected_data || {},
      conversationHistory: row.conversation_history || [],
      location: row.location,
      status: row.status,
      lastMessageAt: row.last_message_at,
      expiresAt: row.expires_at,
    };
  }
}
