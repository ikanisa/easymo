/**
 * Agent Session Management
 * 
 * Functions for tracking and managing agent chat sessions.
 * Sessions track conversation state, presented options, and user selections.
 */

import type { SupabaseClient } from "../../_shared/supabase.ts";
import type { AgentType } from "./agent_orchestrator.ts";
import type { ListOption } from "./message_formatter.ts";

export interface AgentChatSession {
  id: string;
  user_id: string;
  agent_type: AgentType;
  session_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  options_presented: ListOption[] | null;
  last_selection: number | null;
  fallback_triggered: boolean;
  metadata: Record<string, any> | null;
}

/**
 * Get active agent chat session for user by phone number
 */
export async function getAgentChatSession(
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<AgentChatSession | null> {
  try {
    // Get user ID from phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phoneNumber)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // Get active session (within last 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: session, error: sessionError } = await supabase
      .from("agent_chat_sessions")
      .select("*")
      .eq("user_id", profile.id)
      .gte("last_message_at", cutoffTime)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      console.error("Error fetching agent chat session:", sessionError);
      return null;
    }

    return session;
  } catch (error) {
    console.error("Error in getAgentChatSession:", error);
    return null;
  }
}

/**
 * Get active agent chat session for user by user ID
 */
export async function getAgentChatSessionByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentChatSession | null> {
  try {
    // Get active session (within last 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: session, error: sessionError } = await supabase
      .from("agent_chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("last_message_at", cutoffTime)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      console.error("Error fetching agent chat session:", sessionError);
      return null;
    }

    return session;
  } catch (error) {
    console.error("Error in getAgentChatSessionByUserId:", error);
    return null;
  }
}

/**
 * Save or update agent chat session
 */
export async function saveAgentChatSession(
  supabase: SupabaseClient,
  data: {
    user_id: string;
    agent_type: AgentType;
    session_id: string;
    options_presented?: ListOption[];
    last_selection?: number;
    fallback_triggered?: boolean;
    message_count?: number;
    metadata?: Record<string, any>;
  }
): Promise<AgentChatSession | null> {
  try {
    const now = new Date().toISOString();
    
    // Check if session already exists
    const { data: existing } = await supabase
      .from("agent_chat_sessions")
      .select("*")
      .eq("session_id", data.session_id)
      .maybeSingle();

    if (existing) {
      // Update existing session
      const { data: updated, error } = await supabase
        .from("agent_chat_sessions")
        .update({
          last_message_at: now,
          message_count: (existing.message_count || 0) + (data.message_count || 1),
          options_presented: data.options_presented || existing.options_presented,
          last_selection: data.last_selection ?? existing.last_selection,
          fallback_triggered: data.fallback_triggered ?? existing.fallback_triggered,
          metadata: { ...existing.metadata, ...data.metadata },
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating agent chat session:", error);
        return null;
      }

      return updated;
    } else {
      // Create new session
      const { data: created, error } = await supabase
        .from("agent_chat_sessions")
        .insert({
          id: crypto.randomUUID(),
          user_id: data.user_id,
          agent_type: data.agent_type,
          session_id: data.session_id,
          started_at: now,
          last_message_at: now,
          message_count: data.message_count || 1,
          options_presented: data.options_presented || null,
          last_selection: data.last_selection || null,
          fallback_triggered: data.fallback_triggered || false,
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating agent chat session:", error);
        return null;
      }

      return created;
    }
  } catch (error) {
    console.error("Error in saveAgentChatSession:", error);
    return null;
  }
}

/**
 * Update session with user selection
 */
export async function updateSessionSelection(
  supabase: SupabaseClient,
  sessionId: string,
  selection: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("agent_chat_sessions")
      .update({
        last_selection: selection,
        last_message_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    if (error) {
      console.error("Error updating session selection:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in updateSessionSelection:", error);
    return false;
  }
}

/**
 * Trigger fallback for session
 */
export async function triggerSessionFallback(
  supabase: SupabaseClient,
  sessionId: string,
  reason?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("agent_chat_sessions")
      .update({
        fallback_triggered: true,
        metadata: {
          fallback_reason: reason || "user_requested",
          fallback_at: new Date().toISOString(),
        },
        last_message_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    if (error) {
      console.error("Error triggering session fallback:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in triggerSessionFallback:", error);
    return false;
  }
}

/**
 * Clear agent chat session
 */
export async function clearAgentChatSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("agent_chat_sessions")
      .delete()
      .eq("session_id", sessionId);

    if (error) {
      console.error("Error clearing agent chat session:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in clearAgentChatSession:", error);
    return false;
  }
}

/**
 * Clear all sessions for a user
 */
export async function clearUserSessions(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("agent_chat_sessions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Error clearing user sessions:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in clearUserSessions:", error);
    return false;
  }
}

/**
 * Get session statistics for monitoring
 */
export async function getSessionStats(
  supabase: SupabaseClient,
  agentType?: AgentType
): Promise<{
  total_sessions: number;
  active_sessions: number;
  avg_message_count: number;
  fallback_rate: number;
} | null> {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from("agent_chat_sessions")
      .select("*");

    if (agentType) {
      query = query.eq("agent_type", agentType);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error("Error fetching session stats:", error);
      return null;
    }

    if (!sessions || sessions.length === 0) {
      return {
        total_sessions: 0,
        active_sessions: 0,
        avg_message_count: 0,
        fallback_rate: 0,
      };
    }

    const activeSessions = sessions.filter(
      s => new Date(s.last_message_at) >= new Date(cutoffTime)
    );

    const totalMessages = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0);
    const fallbackCount = sessions.filter(s => s.fallback_triggered).length;

    return {
      total_sessions: sessions.length,
      active_sessions: activeSessions.length,
      avg_message_count: sessions.length > 0 ? totalMessages / sessions.length : 0,
      fallback_rate: sessions.length > 0 ? fallbackCount / sessions.length : 0,
    };
  } catch (error) {
    console.error("Error in getSessionStats:", error);
    return null;
  }
}
