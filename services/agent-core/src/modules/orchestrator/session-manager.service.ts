import { isFeatureEnabled } from "@easymo/commons";
import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

import {
  AgentSession,
  CreateSessionRequest,
  FlowType,
  SessionStatus,
} from "./types";

/**
 * Session Manager Service
 * 
 * Manages agent negotiation sessions lifecycle:
 * - Creates new sessions with 5-minute windows
 * - Tracks session state transitions
 * - Enforces deadline constraints
 * - Monitors expiring sessions
 * 
 * @service SessionManagerService
 */
@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly DEFAULT_WINDOW_MINUTES = 5;
  private readonly supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new agent negotiation session
   * 
   * @param request - Session creation parameters
   * @returns Created session with deadline set
   * 
   * @throws Error if feature flag is disabled
   * @throws Error if userId is invalid
   */
  async createSession(request: CreateSessionRequest): Promise<AgentSession> {
    // Check feature flag
    if (!isFeatureEnabled("agent.negotiation")) {
      throw new Error("Agent negotiation feature is not enabled");
    }

    const windowMinutes = request.windowMinutes ?? this.DEFAULT_WINDOW_MINUTES;
    const now = new Date();
    const deadline = new Date(now.getTime() + windowMinutes * 60 * 1000);

    this.logger.log({
      event: "SESSION_CREATE",
      userId: this.maskUserId(request.userId),
      flowType: request.flowType,
      windowMinutes,
      deadline: deadline.toISOString(),
    });

    // Insert into database
    const { data, error } = await this.supabase
      .from("agent_sessions")
      .insert({
        user_id: request.userId,
        flow_type: request.flowType,
        status: "searching",
        request_data: request.requestData,
        deadline_at: deadline.toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error({
        event: "SESSION_CREATE_FAILED",
        error: error.message,
        userId: this.maskUserId(request.userId),
      });
      throw new Error(`Failed to create session: ${error.message}`);
    }

    const session: AgentSession = {
      id: data.id,
      userId: data.user_id,
      flowType: data.flow_type,
      status: data.status,
      requestData: data.request_data,
      startedAt: new Date(data.started_at),
      deadlineAt: new Date(data.deadline_at),
      quotesCollected: [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };

    return session;
  }

  /**
   * Update session status
   * 
   * @param sessionId - Session identifier
   * @param status - New status
   * @param resultData - Optional result data
   * 
   * @throws Error if session not found
   * @throws Error if invalid status transition
   */
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    resultData?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log({
      event: "SESSION_STATUS_UPDATE",
      sessionId,
      newStatus: status,
      hasResultData: Boolean(resultData),
    });

    const updateData: Record<string, unknown> = { status };
    if (resultData) {
      updateData.result_data = resultData;
    }
    if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from("agent_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) {
      this.logger.error({
        event: "SESSION_UPDATE_FAILED",
        error: error.message,
        sessionId,
      });
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Check if session has expired
   * 
   * @param sessionId - Session identifier
   * @returns True if session deadline has passed
   */
  async isSessionExpired(sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("agent_sessions")
      .select("deadline_at")
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      return true; // Assume expired if not found
    }

    return new Date(data.deadline_at) < new Date();
  }

  /**
   * Get sessions nearing deadline
   * 
   * Used by background workers to send "need more time?" prompts
   * 
   * @param minutesThreshold - How many minutes before deadline
   * @returns Array of expiring sessions
   */
  async getExpiringSessions(minutesThreshold: number = 1): Promise<AgentSession[]> {
    this.logger.debug({
      event: "GET_EXPIRING_SESSIONS",
      minutesThreshold,
    });

    const { data, error } = await this.supabase.rpc("get_expiring_agent_sessions", {
      minutes_threshold: minutesThreshold,
    });

    if (error) {
      this.logger.error({
        event: "GET_EXPIRING_SESSIONS_FAILED",
        error: error.message,
      });
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.session_id,
      userId: row.user_id,
      flowType: row.flow_type,
      status: "searching",
      requestData: {},
      startedAt: new Date(),
      deadlineAt: new Date(Date.now() + row.minutes_remaining * 60 * 1000),
      quotesCollected: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Get session by ID
   * 
   * @param sessionId - Session identifier
   * @returns Session or null if not found
   */
  async getSession(sessionId: string): Promise<AgentSession | null> {
    const { data, error } = await this.supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      flowType: data.flow_type,
      status: data.status,
      requestData: data.request_data || {},
      resultData: data.result_data,
      startedAt: new Date(data.started_at),
      deadlineAt: new Date(data.deadline_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      selectedQuoteId: data.selected_quote_id,
      quotesCollected: [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get all active sessions for a user
   * 
   * @param userId - User identifier
   * @returns Array of active sessions
   */
  async getUserActiveSessions(userId: string): Promise<AgentSession[]> {
    this.logger.debug({
      event: "GET_USER_ACTIVE_SESSIONS",
      userId: this.maskUserId(userId),
    });

    const { data, error } = await this.supabase
      .from("agent_sessions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["searching", "negotiating", "presenting"])
      .order("started_at", { ascending: false });

    if (error) {
      this.logger.error({
        event: "GET_USER_SESSIONS_FAILED",
        error: error.message,
      });
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      flowType: row.flow_type,
      status: row.status,
      requestData: row.request_data || {},
      resultData: row.result_data,
      startedAt: new Date(row.started_at),
      deadlineAt: new Date(row.deadline_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      selectedQuoteId: row.selected_quote_id,
      quotesCollected: [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Cancel a session
   * 
   * @param sessionId - Session identifier
   * @param reason - Cancellation reason
   */
  async cancelSession(sessionId: string, reason?: string): Promise<void> {
    this.logger.log({
      event: "SESSION_CANCELLED",
      sessionId,
      reason,
    });

    const { error } = await this.supabase
      .from("agent_sessions")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      this.logger.error({
        event: "SESSION_CANCEL_FAILED",
        error: error.message,
        sessionId,
      });
      throw new Error(`Failed to cancel session: ${error.message}`);
    }
  }

  /**
   * Mark session as timed out
   * 
   * Called by background worker when deadline passes
   * 
   * @param sessionId - Session identifier
   */
  async timeoutSession(sessionId: string): Promise<void> {
    this.logger.warn({
      event: "SESSION_TIMEOUT",
      sessionId,
    });

    await this.updateSessionStatus(sessionId, "timeout");

    // TODO: Notify user of timeout
    // Offer to extend window or present partial results
  }

  /**
   * Mask user ID for logging
   * 
   * @param userId - User identifier
   * @returns Masked string for PII protection
   */
  private maskUserId(userId: string): string {
    if (userId.length < 8) return "***";
    return userId.substring(0, 4) + "***" + userId.substring(userId.length - 4);
  }
}
