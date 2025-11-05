import { Injectable, Logger } from "@nestjs/common";
import { isFeatureEnabled } from "@easymo/commons";
import {
  AgentSession,
  CreateSessionRequest,
  SessionStatus,
  FlowType,
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

    // TODO: Insert into database (agent_sessions table)
    // For now, return mock session
    const session: AgentSession = {
      id: this.generateId(),
      userId: request.userId,
      flowType: request.flowType,
      status: "searching",
      requestData: request.requestData,
      startedAt: now,
      deadlineAt: deadline,
      quotesCollected: [],
      createdAt: now,
      updatedAt: now,
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

    // TODO: Update database
    // Validate status transition
    // Update updated_at timestamp
  }

  /**
   * Check if session has expired
   * 
   * @param sessionId - Session identifier
   * @returns True if session deadline has passed
   */
  async isSessionExpired(sessionId: string): Promise<boolean> {
    // TODO: Query database
    // For now, return mock
    return false;
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

    // TODO: Query database using get_expiring_agent_sessions function
    return [];
  }

  /**
   * Get session by ID
   * 
   * @param sessionId - Session identifier
   * @returns Session or null if not found
   */
  async getSession(sessionId: string): Promise<AgentSession | null> {
    // TODO: Query database
    return null;
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

    // TODO: Query database
    return [];
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

    // TODO: Update database
    // Notify vendors if needed
    // Clean up pending operations
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
   * Generate a unique session ID
   * 
   * @returns UUID string
   */
  private generateId(): string {
    // Use native crypto.randomUUID() for standards compliance
    return crypto.randomUUID();
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
