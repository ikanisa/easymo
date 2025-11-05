import { createServiceRoleClient, handleOptions, json } from "../_shared/admin.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { isFeatureEnabled } from "../_shared/feature-flags.ts";
import {
  logSessionTimeout,
  logAgentEvent,
  logAgentError,
} from "../_shared/agent-observability.ts";

/**
 * Agent Monitor Edge Function
 * 
 * Background worker that monitors agent negotiation sessions for:
 * 1. Expiring sessions (approaching 5-minute deadline)
 * 2. Timed out sessions (past deadline)
 * 3. Expired quotes
 * 
 * Should be called periodically (every minute) via cron or scheduled job.
 * 
 * Endpoints:
 * - POST /agent-monitor/check-expiring - Check sessions nearing deadline
 * - POST /agent-monitor/check-timeouts - Mark expired sessions as timeout
 * - POST /agent-monitor/expire-quotes - Expire old quotes
 */

const supabase = createServiceRoleClient();

/**
 * Check for sessions approaching deadline
 * Send "need more time?" prompts to users
 */
async function checkExpiringSessions(): Promise<Response> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return json({ checked: 0, message: "Feature disabled" });
  }

  try {
    // Get sessions expiring in next 1 minute
    const { data: sessions, error } = await supabase.rpc(
      "get_expiring_agent_sessions",
      { minutes_threshold: 1 },
    );

    if (error) throw error;

    const expiringSessions = sessions || [];
    let notified = 0;

    for (const session of expiringSessions) {
      // Check if we have any quotes
      if (session.quotes_count === 0) {
        // No quotes yet, send warning
        await sendExpiringWarning(session.session_id, session.user_id, session.minutes_remaining);
        notified++;
      } else if (session.quotes_count < 3) {
        // Few quotes, offer to present partial results
        await sendPartialResultsOffer(
          session.session_id,
          session.user_id,
          session.quotes_count,
          session.minutes_remaining,
        );
        notified++;
      }
      // If 3+ quotes, session should be in presenting state already
    }

    await logStructuredEvent("AGENT_MONITOR_EXPIRING_CHECK", {
      sessionsChecked: expiringSessions.length,
      notificationsSent: notified,
    });

    return json({
      checked: expiringSessions.length,
      notified,
      sessions: expiringSessions.map((s) => ({
        sessionId: s.session_id,
        minutesRemaining: s.minutes_remaining,
        quotesCount: s.quotes_count,
      })),
    });
  } catch (error) {
    logAgentError("monitor_expiring_check", error);
    return json({ error: "check_failed", message: String(error) }, 500);
  }
}

/**
 * Check for timed out sessions
 * Mark sessions past deadline as timeout
 */
async function checkTimeouts(): Promise<Response> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return json({ checked: 0, message: "Feature disabled" });
  }

  try {
    // Find sessions past deadline with active status
    const { data: sessions, error } = await supabase
      .from("agent_sessions")
      .select("id, user_id, deadline_at")
      .in("status", ["searching", "negotiating"])
      .lt("deadline_at", new Date().toISOString());

    if (error) throw error;

    const timedOutSessions = sessions || [];
    let processed = 0;

    for (const session of timedOutSessions) {
      // Count received quotes
      const { count: quotesCount } = await supabase
        .from("agent_quotes")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("status", "received");

      const hasQuotes = quotesCount && quotesCount > 0;

      // Update session status
      await supabase
        .from("agent_sessions")
        .update({
          status: "timeout",
          result_data: {
            reason: hasQuotes ? "deadline_expired_with_quotes" : "deadline_expired_no_quotes",
            quotes_received: quotesCount || 0,
          },
        })
        .eq("id", session.id);

      logSessionTimeout(session.id, quotesCount || 0, hasQuotes);

      // If we have quotes, present them to user
      if (hasQuotes) {
        await presentPartialResults(session.id, session.user_id);
      } else {
        await notifyNoResults(session.id, session.user_id);
      }

      processed++;
    }

    await logStructuredEvent("AGENT_MONITOR_TIMEOUT_CHECK", {
      sessionsChecked: timedOutSessions.length,
      sessionsTimedOut: processed,
    });

    return json({
      checked: timedOutSessions.length,
      timedOut: processed,
      sessions: timedOutSessions.map((s) => ({ sessionId: s.id })),
    });
  } catch (error) {
    logAgentError("monitor_timeout_check", error);
    return json({ error: "check_failed", message: String(error) }, 500);
  }
}

/**
 * Expire old quotes
 */
async function expireOldQuotes(): Promise<Response> {
  if (!isFeatureEnabled("agent.negotiation")) {
    return json({ expired: 0, message: "Feature disabled" });
  }

  try {
    const { data: expired, error } = await supabase
      .from("agent_quotes")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) throw error;

    const expiredCount = expired?.length || 0;

    if (expiredCount > 0) {
      await logStructuredEvent("AGENT_QUOTES_EXPIRED", {
        count: expiredCount,
      });
    }

    return json({ expired: expiredCount });
  } catch (error) {
    logAgentError("expire_quotes", error);
    return json({ error: "expire_failed", message: String(error) }, 500);
  }
}

/**
 * Send warning about approaching deadline
 */
async function sendExpiringWarning(
  sessionId: string,
  userId: string,
  minutesRemaining: number,
): Promise<void> {
  logAgentEvent("AGENT_DEADLINE_WARNING", {
    sessionId,
    minutesRemaining,
    quotesCount: 0,
  });

  // TODO: Send WhatsApp message to user
  // "⏱️ Still searching for drivers... No responses yet. Need more time?"
}

/**
 * Offer to present partial results
 */
async function sendPartialResultsOffer(
  sessionId: string,
  userId: string,
  quotesCount: number,
  minutesRemaining: number,
): Promise<void> {
  logAgentEvent("AGENT_DEADLINE_WARNING", {
    sessionId,
    minutesRemaining,
    quotesCount,
  });

  // TODO: Send WhatsApp message to user
  // "⏱️ I have ${quotesCount} quote(s) so far. Want to see them now or wait for more?"
}

/**
 * Present partial results to user
 */
async function presentPartialResults(sessionId: string, userId: string): Promise<void> {
  // TODO: Send quote presentation via WhatsApp
  // Use sendQuotePresentationToUser from agent_quotes.ts
  logAgentEvent("AGENT_PARTIAL_RESULTS_PRESENTED", {
    sessionId,
  });
}

/**
 * Notify user of no results
 */
async function notifyNoResults(sessionId: string, userId: string): Promise<void> {
  logAgentEvent("AGENT_SESSION_TIMEOUT", {
    sessionId,
    quotesReceived: 0,
  });

  // TODO: Send WhatsApp message to user
  // "😔 No drivers responded within the time window. Try again or expand search radius?"
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Route requests
  if (req.method === "POST" && path.endsWith("/check-expiring")) {
    return await checkExpiringSessions();
  }

  if (req.method === "POST" && path.endsWith("/check-timeouts")) {
    return await checkTimeouts();
  }

  if (req.method === "POST" && path.endsWith("/expire-quotes")) {
    return await expireOldQuotes();
  }

  // Run all checks in sequence (for cron)
  if (req.method === "POST" && path.endsWith("/run-all")) {
    const results = {
      expiring: await checkExpiringSessions().then((r) => r.json()),
      timeouts: await checkTimeouts().then((r) => r.json()),
      expiredQuotes: await expireOldQuotes().then((r) => r.json()),
    };
    return json(results);
  }

  return json({ error: "not_found" }, 404);
});
