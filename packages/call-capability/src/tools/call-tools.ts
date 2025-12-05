/**
 * ADK Tools for Call Capability
 * 
 * Tools that can be registered with Google ADK agents
 * following the ADK tool pattern.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CallSession, CallSessionHelpers } from '../call-session';
import { TranscriptLogger, TranscriptHelpers } from '../transcript-logger';
import { CallSummarizer, SummaryHelpers } from '../summarizer';
import {
  AGENT_IDS,
  AgentId,
  CallChannel,
  CallDirection,
  CallStatus,
  TranscriptRole,
} from '../types';

// ============================================================================
// TOOL DEFINITIONS (ADK-compatible schema)
// ============================================================================

/**
 * Tool: save_call_event
 * Creates or updates a call record
 */
export const saveCallEventTool = {
  name: 'save_call_event',
  description: 'Create or update a call record. Use at call start (event=start), during (event=update), or end (event=end).',
  parameters: {
    type: 'object',
    properties: {
      event: {
        type: 'string',
        enum: ['start', 'update', 'end'],
        description: 'Event type',
      },
      call_id: {
        type: 'string',
        description: 'Call ID (required for update/end events)',
      },
      agent_id: {
        type: 'string',
        enum: Object.values(AGENT_IDS),
        description: 'Agent handling the call',
      },
      channel: {
        type: 'string',
        enum: ['phone', 'whatsapp_call', 'whatsapp_voice_note'],
        description: 'Call channel',
      },
      direction: {
        type: 'string',
        enum: ['inbound', 'outbound'],
        description: 'Call direction',
      },
      status: {
        type: 'string',
        enum: ['initiated', 'in_progress', 'completed', 'abandoned', 'failed'],
        description: 'Call status (for update/end)',
      },
      provider_call_id: {
        type: 'string',
        description: 'External call ID from telephony provider',
      },
      from_number: { type: 'string', description: 'Caller phone number' },
      to_number: { type: 'string', description: 'Called phone number' },
      user_id: { type: 'string', description: 'User ID if authenticated' },
      metadata: { type: 'object', description: 'Additional metadata' },
    },
    required: ['event'],
  },
};

/**
 * Tool: append_call_transcript
 * Adds a transcript chunk to the call
 */
export const appendTranscriptTool = {
  name: 'append_call_transcript',
  description: 'Add a transcript chunk to the active call. Call for each user/assistant utterance.',
  parameters: {
    type: 'object',
    properties: {
      call_id: {
        type: 'string',
        description: 'Call ID',
      },
      role: {
        type: 'string',
        enum: ['user', 'assistant', 'system'],
        description: 'Who spoke: user (caller), assistant (agent), or system (tool/event)',
      },
      text: {
        type: 'string',
        description: 'The spoken/transcribed text',
      },
      confidence: {
        type: 'number',
        description: 'STT confidence score (0.0-1.0)',
      },
    },
    required: ['call_id', 'role', 'text'],
  },
};

/**
 * Tool: save_call_summary
 * Saves the call summary and extracted entities
 */
export const saveSummaryTool = {
  name: 'save_call_summary',
  description: 'Save a summary of the call with structured entities. Call at end of conversation.',
  parameters: {
    type: 'object',
    properties: {
      call_id: {
        type: 'string',
        description: 'Call ID',
      },
      summary: {
        type: 'string',
        description: 'Natural language summary of the call',
      },
      main_intent: {
        type: 'string',
        description: 'Primary intent of the caller',
      },
      sentiment: {
        type: 'string',
        enum: ['positive', 'neutral', 'negative', 'mixed'],
        description: 'Overall sentiment of the call',
      },
      language: {
        type: 'string',
        description: 'Detected language code (en, rw, sw, fr)',
      },
      entities: {
        type: 'object',
        description: 'Structured data extracted from the call',
      },
      next_actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['notify', 'callback', 'match', 'escalate', 'task'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            description: { type: 'string' },
            scheduled_for: { type: 'string' },
          },
        },
        description: 'Recommended follow-up actions',
      },
    },
    required: ['call_id', 'summary'],
  },
};

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

export type ToolContext = {
  supabase: SupabaseClient;
  userId?: string;
};

/**
 * Execute save_call_event tool
 */
export async function executeSaveCallEvent(
  params: {
    event: 'start' | 'update' | 'end';
    call_id?: string;
    agent_id?: AgentId;
    channel?: CallChannel;
    direction?: CallDirection;
    status?: CallStatus;
    provider_call_id?: string;
    from_number?: string;
    to_number?: string;
    user_id?: string;
    metadata?: Record<string, unknown>;
  },
  context: ToolContext
): Promise<{ call_id: string; status: string }> {
  const { supabase, userId } = context;

  if (params.event === 'start') {
    if (!params.agent_id || !params.channel || !params.direction) {
      throw new Error('start event requires agent_id, channel, and direction');
    }

    const call = await CallSessionHelpers.createCall(supabase, {
      user_id: params.user_id || userId,
      agent_id: params.agent_id,
      channel: params.channel,
      direction: params.direction,
      provider_call_id: params.provider_call_id,
      from_number: params.from_number,
      to_number: params.to_number,
      metadata: params.metadata,
    });

    return { call_id: call.id, status: call.status };
  }

  if (!params.call_id) {
    throw new Error('call_id required for update/end events');
  }

  if (params.event === 'end') {
    const endStatus = params.status as 'completed' | 'abandoned' | 'failed' || 'completed';
    const session = new CallSession(supabase);
    await session.attach(params.call_id);
    const call = await session.end(endStatus);
    return { call_id: call.id, status: call.status };
  }

  // Update event
  const call = await CallSessionHelpers.updateCall(supabase, {
    call_id: params.call_id,
    status: params.status,
    metadata: params.metadata,
  });

  return { call_id: call.id, status: call.status };
}

/**
 * Execute append_call_transcript tool
 */
export async function executeAppendTranscript(
  params: {
    call_id: string;
    role: TranscriptRole;
    text: string;
    confidence?: number;
  },
  context: ToolContext
): Promise<{ success: boolean; seq: number }> {
  const { supabase } = context;

  const chunk = await TranscriptHelpers.insertChunk(supabase, {
    call_id: params.call_id,
    role: params.role,
    text: params.text,
    confidence: params.confidence,
  });

  return { success: true, seq: chunk.seq };
}

/**
 * Execute save_call_summary tool
 */
export async function executeSaveSummary(
  params: {
    call_id: string;
    summary: string;
    main_intent?: string;
    sentiment?: string;
    language?: string;
    entities?: Record<string, unknown>;
    next_actions?: Array<{
      type: string;
      priority: string;
      description: string;
      scheduled_for?: string;
    }>;
  },
  context: ToolContext
): Promise<{ success: boolean; call_id: string }> {
  const { supabase } = context;

  const summarizer = new CallSummarizer(supabase);
  await summarizer.save({
    call_id: params.call_id,
    summary: params.summary,
    main_intent: params.main_intent,
    sentiment: params.sentiment as any,
    language: params.language,
    entities: params.entities,
    next_actions: params.next_actions as any,
  });

  return { success: true, call_id: params.call_id };
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export const CALL_TOOLS = [
  saveCallEventTool,
  appendTranscriptTool,
  saveSummaryTool,
];

export const CALL_TOOL_EXECUTORS = {
  save_call_event: executeSaveCallEvent,
  append_call_transcript: executeAppendTranscript,
  save_call_summary: executeSaveSummary,
};

/**
 * Get all call capability tool schemas
 */
export function getCallToolSchemas() {
  return CALL_TOOLS;
}

/**
 * Execute a call tool by name
 */
export async function executeCallTool(
  toolName: string,
  params: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> {
  const executor = CALL_TOOL_EXECUTORS[toolName as keyof typeof CALL_TOOL_EXECUTORS];
  if (!executor) {
    throw new Error(`Unknown call tool: ${toolName}`);
  }
  return executor(params as any, context);
}
