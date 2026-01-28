/**
 * Omnichannel Session Manager
 * 
 * Manages user sessions across voice, WhatsApp, and SMS channels
 * with shared context and state persistence.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js';

import { logStructuredEvent } from '../observability.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export interface OmnichannelSession {
  id: string;
  profile_id: string;
  call_id?: string;
  primary_channel: 'voice' | 'whatsapp' | 'sms';
  active_channels: string[];
  last_agent_id?: string;
  last_intent?: string;
  context: Record<string, any>;
  summary_sent_whatsapp: boolean;
  summary_sent_sms: boolean;
  started_at: string;
  updated_at: string;
  expires_at: string;
  status: 'active' | 'closed' | 'follow_up';
}

export interface SessionContext {
  [key: string]: any;
}

/**
 * Get or create an omnichannel session for a user
 */
export async function getOrCreateSession(
  profileId: string,
  options?: {
    primaryChannel?: 'voice' | 'whatsapp' | 'sms';
    callId?: string;
    agentId?: string;
    intent?: string;
  }
): Promise<OmnichannelSession | null> {
  const correlationId = crypto.randomUUID();

  try {
    logStructuredEvent('SESSION_GET_OR_CREATE_START', {
      profileId,
      primaryChannel: options?.primaryChannel,
      callId: options?.callId,
      correlationId,
    });

    // Call the database function to get or create session
    const { data, error } = await supabase.rpc('get_or_create_omnichannel_session', {
      p_profile_id: profileId,
      p_primary_channel: options?.primaryChannel || 'voice',
      p_call_id: options?.callId || null,
      p_agent_id: options?.agentId || null,
      p_intent: options?.intent || null,
    });

    if (error) {
      logStructuredEvent('SESSION_GET_OR_CREATE_ERROR', {
        profileId,
        error: error.message,
        correlationId,
      }, 'error');
      return null;
    }

    const sessionId = data as string;

    // Fetch the full session record
    const { data: session, error: fetchError } = await supabase
      .from('omnichannel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      logStructuredEvent('SESSION_FETCH_ERROR', {
        sessionId,
        error: fetchError.message,
        correlationId,
      }, 'error');
      return null;
    }

    logStructuredEvent('SESSION_GET_OR_CREATE_SUCCESS', {
      sessionId: session.id,
      profileId,
      status: session.status,
      correlationId,
    });

    return session as OmnichannelSession;
  } catch (error) {
    logStructuredEvent('SESSION_GET_OR_CREATE_EXCEPTION', {
      profileId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return null;
  }
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'closed' | 'follow_up',
  context?: SessionContext
): Promise<boolean> {
  const correlationId = crypto.randomUUID();

  try {
    logStructuredEvent('SESSION_UPDATE_STATUS_START', {
      sessionId,
      status,
      hasContext: !!context,
      correlationId,
    });

    const { data, error } = await supabase.rpc('update_omnichannel_session_status', {
      p_session_id: sessionId,
      p_status: status,
      p_context: context || null,
    });

    if (error) {
      logStructuredEvent('SESSION_UPDATE_STATUS_ERROR', {
        sessionId,
        status,
        error: error.message,
        correlationId,
      }, 'error');
      return false;
    }

    const success = data as boolean;

    logStructuredEvent('SESSION_UPDATE_STATUS_SUCCESS', {
      sessionId,
      status,
      success,
      correlationId,
    });

    return success;
  } catch (error) {
    logStructuredEvent('SESSION_UPDATE_STATUS_EXCEPTION', {
      sessionId,
      status,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return false;
  }
}

/**
 * Get session context
 */
export async function getSessionContext(
  sessionId: string
): Promise<SessionContext | null> {
  const correlationId = crypto.randomUUID();

  try {
    const { data: session, error } = await supabase
      .from('omnichannel_sessions')
      .select('context')
      .eq('id', sessionId)
      .single();

    if (error) {
      logStructuredEvent('SESSION_GET_CONTEXT_ERROR', {
        sessionId,
        error: error.message,
        correlationId,
      }, 'error');
      return null;
    }

    return session.context as SessionContext;
  } catch (error) {
    logStructuredEvent('SESSION_GET_CONTEXT_EXCEPTION', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return null;
  }
}

/**
 * Add or update context data in session
 */
export async function updateSessionContext(
  sessionId: string,
  contextUpdate: SessionContext
): Promise<boolean> {
  const correlationId = crypto.randomUUID();

  try {
    logStructuredEvent('SESSION_UPDATE_CONTEXT_START', {
      sessionId,
      contextKeys: Object.keys(contextUpdate),
      correlationId,
    });

    // Get current context
    const currentContext = await getSessionContext(sessionId);

    // Merge with update
    const newContext = {
      ...(currentContext || {}),
      ...contextUpdate,
    };

    // Update session
    const { error } = await supabase
      .from('omnichannel_sessions')
      .update({
        context: newContext,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      logStructuredEvent('SESSION_UPDATE_CONTEXT_ERROR', {
        sessionId,
        error: error.message,
        correlationId,
      }, 'error');
      return false;
    }

    logStructuredEvent('SESSION_UPDATE_CONTEXT_SUCCESS', {
      sessionId,
      contextKeys: Object.keys(contextUpdate),
      correlationId,
    });

    return true;
  } catch (error) {
    logStructuredEvent('SESSION_UPDATE_CONTEXT_EXCEPTION', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return false;
  }
}

/**
 * Mark summary as sent for a channel
 */
export async function markSummarySent(
  sessionId: string,
  channel: 'whatsapp' | 'sms'
): Promise<boolean> {
  const correlationId = crypto.randomUUID();

  try {
    const updateField = channel === 'whatsapp' ? 'summary_sent_whatsapp' : 'summary_sent_sms';

    const { error } = await supabase
      .from('omnichannel_sessions')
      .update({
        [updateField]: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      logStructuredEvent('SESSION_MARK_SUMMARY_SENT_ERROR', {
        sessionId,
        channel,
        error: error.message,
        correlationId,
      }, 'error');
      return false;
    }

    logStructuredEvent('SESSION_MARK_SUMMARY_SENT', {
      sessionId,
      channel,
      correlationId,
    });

    return true;
  } catch (error) {
    logStructuredEvent('SESSION_MARK_SUMMARY_SENT_EXCEPTION', {
      sessionId,
      channel,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return false;
  }
}

/**
 * Get active session for a profile
 */
export async function getActiveSession(
  profileId: string
): Promise<OmnichannelSession | null> {
  const correlationId = crypto.randomUUID();

  try {
    const { data: session, error } = await supabase
      .from('omnichannel_sessions')
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logStructuredEvent('SESSION_GET_ACTIVE_ERROR', {
        profileId,
        error: error.message,
        correlationId,
      }, 'error');
      return null;
    }

    if (!session) {
      logStructuredEvent('SESSION_GET_ACTIVE_NOT_FOUND', {
        profileId,
        correlationId,
      });
      return null;
    }

    logStructuredEvent('SESSION_GET_ACTIVE_SUCCESS', {
      profileId,
      sessionId: session.id,
      correlationId,
    });

    return session as OmnichannelSession;
  } catch (error) {
    logStructuredEvent('SESSION_GET_ACTIVE_EXCEPTION', {
      profileId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, 'error');
    return null;
  }
}

/**
 * Close a session
 */
export async function closeSession(sessionId: string): Promise<boolean> {
  return updateSessionStatus(sessionId, 'closed');
}
