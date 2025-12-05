/**
 * Voice Gateway - Call Session Manager
 * 
 * Manages active call sessions with audio streaming,
 * transcription, and OpenAI Realtime integration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

import { AGI_TOOL_DEFINITIONS, executeAGITool, formatToolResult, type ToolExecutionContext } from './agi-tools';
import { config } from './config';
import { logger } from './logger';
import { AGIBridge, ToolCall } from './agi-bridge';
import { loadRealtimeFunctions, buildCallCenterPrompt } from './realtime-functions-dynamic';

export type CallState = 'ringing' | 'answered' | 'in_progress' | 'ending' | 'ended';

export interface CallSessionConfig {
  callId: string;
  providerCallId?: string;
  fromNumber: string;
  toNumber: string;
  agentId: string;
  direction: 'inbound' | 'outbound';
  language?: string;
  voiceStyle?: string;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
  /** Enable AGI function calling (default: true) */
  enableTools?: boolean;
}

export interface TranscriptChunk {
  role: 'user' | 'assistant' | 'system';
  text: string;
  confidence?: number;
  timestamp: Date;
}

/**
 * Manages a single call session
 */
export class CallSession extends EventEmitter {
  readonly callId: string;
  readonly config: CallSessionConfig;
  
  private state: CallState = 'ringing';
  private supabase: SupabaseClient;
  private realtimeWs: WebSocket | null = null;
  private agiBridge: AGIBridge;
  private transcriptBuffer: TranscriptChunk[] = [];
  private transcriptSeq: number = 0;
  private startedAt: Date | null = null;
  private endedAt: Date | null = null;
  private userId: string | null = null;

  constructor(sessionConfig: CallSessionConfig) {
    super();
    this.callId = sessionConfig.callId;
    this.config = {
      ...sessionConfig,
      enableTools: sessionConfig.enableTools ?? config.AGI_TOOLS_ENABLED,
    };
    
    this.supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Initialize AGI Bridge for tool execution
    this.agiBridge = new AGIBridge(this.callId);
  }

  /**
   * Initialize the call session
   */
  async initialize(): Promise<void> {
    logger.info({ callId: this.callId, msg: 'call_session.initializing' });

    // Create call record in DB
    const { error } = await this.supabase.from('calls').insert({
      id: this.callId,
      agent_id: this.config.agentId,
      channel: 'phone',
      direction: this.config.direction,
      status: 'initiated',
      provider_call_id: this.config.providerCallId,
      from_number: this.config.fromNumber,
      to_number: this.config.toNumber,
      metadata: {
        language: this.config.language || 'en-US',
        voice_style: this.config.voiceStyle,
        ...this.config.metadata,
      },
      started_at: new Date().toISOString(),
    });

    if (error) {
      logger.error({ callId: this.callId, error, msg: 'call_session.db_insert_failed' });
      throw error;
    }

    this.emit('initialized');
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connectRealtime(): Promise<void> {
    const model = config.OPENAI_REALTIME_MODEL;
    const url = `wss://api.openai.com/v1/realtime?model=${model}`;

    this.realtimeWs = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    this.realtimeWs.on('open', () => {
      logger.info({ callId: this.callId, msg: 'realtime.connected' });
      this.initializeRealtimeSession();
      this.emit('realtime_connected');
    });

    this.realtimeWs.on('message', (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());
        this.handleRealtimeEvent(event);
      } catch (error) {
        logger.error({ callId: this.callId, error, msg: 'realtime.parse_error' });
      }
    });

    this.realtimeWs.on('error', (error) => {
      logger.error({ callId: this.callId, error, msg: 'realtime.error' });
      this.emit('realtime_error', error);
    });

    this.realtimeWs.on('close', () => {
      logger.info({ callId: this.callId, msg: 'realtime.disconnected' });
      this.emit('realtime_disconnected');
    });
  }

  /**
   * Mark call as answered
   */
  async answer(): Promise<void> {
    this.state = 'answered';
    this.startedAt = new Date();

    await this.updateCallStatus('in_progress');
    this.emit('answered');
    
    logger.info({ callId: this.callId, msg: 'call_session.answered' });
  }

  /**
   * Send audio chunk to Realtime API
   */
  sendAudio(audioBuffer: Buffer): void {
    if (this.realtimeWs?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.realtimeWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: audioBuffer.toString('base64'),
    }));
  }

  /**
   * Commit audio buffer and trigger response
   */
  commitAudio(): void {
    if (this.realtimeWs?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.realtimeWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    this.realtimeWs.send(JSON.stringify({ type: 'response.create' }));
  }

  /**
   * Add transcript chunk
   */
  async addTranscript(chunk: TranscriptChunk): Promise<void> {
    this.transcriptBuffer.push(chunk);
    
    // Insert to DB
    await this.supabase.from('call_transcripts').insert({
      call_id: this.callId,
      seq: ++this.transcriptSeq,
      role: chunk.role,
      text: chunk.text,
      confidence: chunk.confidence,
      started_at: chunk.timestamp.toISOString(),
      raw: {},
    });

    this.emit('transcript', chunk);
  }

  /**
   * End the call
   */
  async end(disposition?: string): Promise<void> {
    this.state = 'ending';
    this.endedAt = new Date();

    // Disconnect Realtime
    if (this.realtimeWs) {
      this.realtimeWs.close();
      this.realtimeWs = null;
    }

    // Calculate duration
    const durationSeconds = this.startedAt
      ? Math.floor((this.endedAt.getTime() - this.startedAt.getTime()) / 1000)
      : 0;

    // Update call record
    await this.supabase.from('calls').update({
      status: 'completed',
      ended_at: this.endedAt.toISOString(),
      duration_seconds: durationSeconds,
      metadata: {
        ...this.config.metadata,
        disposition,
      },
    }).eq('id', this.callId);

    this.state = 'ended';
    this.emit('ended', { durationSeconds, disposition });

    logger.info({ 
      callId: this.callId, 
      duration: durationSeconds,
      disposition,
      msg: 'call_session.ended' 
    });
  }

  /**
   * Get full transcript
   */
  getTranscript(): TranscriptChunk[] {
    return [...this.transcriptBuffer];
  }

  /**
   * Get current state
   */
  getState(): CallState {
    return this.state;
  }

  private initializeRealtimeSession(): void {
    if (this.realtimeWs?.readyState !== WebSocket.OPEN) return;

    // Build session configuration with AGI tools
    const sessionConfig: Record<string, unknown> = {
      voice: this.config.voiceStyle || 'alloy',
      instructions: this.config.systemPrompt || this.buildDefaultPrompt(),
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
      // Enable input transcription for transcript logging
      input_audio_transcription: {
        model: 'whisper-1',
      },
    };

    // Add AGI tools if enabled
    if (this.config.enableTools) {
      sessionConfig.tools = AGI_TOOL_DEFINITIONS;
      sessionConfig.tool_choice = 'auto';
      logger.info({ 
        callId: this.callId, 
        toolCount: AGI_TOOL_DEFINITIONS.length,
        msg: 'realtime.tools_configured' 
      });
    }

    this.realtimeWs.send(JSON.stringify({
      type: 'session.update',
      session: sessionConfig,
    // Get user context for personalized prompt
    const userContext = this.config.metadata?.userContext || {};
    const userName = this.config.metadata?.userName as string | undefined;

    this.realtimeWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        voice: this.config.voiceStyle || 'alloy',
        instructions: this.config.systemPrompt || buildCallCenterPrompt({
          language: this.config.language || 'en',
          userName,
          userContext,
        }),
        tools: REALTIME_FUNCTIONS, // Add all AGI tools
        tool_choice: 'auto', // Let AI decide when to use tools
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        temperature: 0.8,
        max_response_output_tokens: 4096,
      },
    }));

    logger.info({
      callId: this.callId,
      toolsCount: REALTIME_FUNCTIONS.length,
      msg: 'realtime.session_initialized_with_tools',
    });
  }

  /**
   * Handle function call from OpenAI Realtime API
   */
  private async handleFunctionCall(event: {
    call_id: string;
    name: string;
    arguments: string;
  }): Promise<void> {
    logger.info({ 
      callId: this.callId, 
      functionName: event.name, 
      msg: 'realtime.function_call_received' 
    });

    try {
      // Parse function arguments
      const args = JSON.parse(event.arguments || '{}');

      // Build execution context
      const context: ToolExecutionContext = {
        callId: this.callId,
        fromNumber: this.config.fromNumber,
        userId: this.userId ?? undefined,
        language: this.config.language,
        supabaseUrl: config.SUPABASE_URL,
        supabaseKey: config.SUPABASE_SERVICE_ROLE_KEY,
      };

      // Execute the tool
      const result = await executeAGITool(event.name, args, context);

      // Send result back to OpenAI Realtime API
      if (this.realtimeWs?.readyState === WebSocket.OPEN) {
        const response = formatToolResult(event.call_id, result);
        this.realtimeWs.send(JSON.stringify(response));

        // Trigger response generation
        this.realtimeWs.send(JSON.stringify({ type: 'response.create' }));
      }

      // Log tool usage in transcript
      await this.addTranscript({
        role: 'system',
        text: `[Tool: ${event.name}] ${result.success ? 'Success' : `Error: ${result.error}`}`,
        timestamp: new Date(),
      });

      // Emit tool event for monitoring
      this.emit('tool_executed', {
        name: event.name,
        args,
        result,
      });

    } catch (error) {
      logger.error({ 
        callId: this.callId, 
        functionName: event.name, 
        error, 
        msg: 'realtime.function_call_error' 
      });

      // Send error result back
      if (this.realtimeWs?.readyState === WebSocket.OPEN) {
        const errorResult = formatToolResult(event.call_id, {
          success: false,
          error: error instanceof Error ? error.message : 'Function execution failed',
        });
        this.realtimeWs.send(JSON.stringify(errorResult));
        this.realtimeWs.send(JSON.stringify({ type: 'response.create' }));
      }
    }
  }

  private handleRealtimeEvent(event: Record<string, unknown>): void {
    const eventType = typeof event.type === 'string' ? event.type : '';
    
    switch (eventType) {
      case 'session.created':
        logger.info({ callId: this.callId, msg: 'realtime.session_created' });
        break;

      case 'session.updated':
        logger.info({ callId: this.callId, msg: 'realtime.session_updated' });
        break;

      case 'response.audio.delta':
        // Audio chunk from AI - send to caller
        this.emit('audio_out', Buffer.from(event.delta as string, 'base64'));
        break;

      case 'response.audio_transcript.delta':
        // AI is speaking
        this.emit('ai_speaking', event.delta);
        break;

      case 'input_audio_buffer.speech_started':
        // User started speaking
        this.emit('user_speaking');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User transcript ready
        this.addTranscript({
          role: 'user',
          text: event.transcript as string,
          timestamp: new Date(),
        });
        break;

      case 'response.function_call_arguments.done':
        // Function call requested by AI
        this.handleFunctionCall({
          call_id: event.call_id as string,
          name: event.name as string,
          arguments: event.arguments as string,
        });
        break;

      case 'response.done': {
        // AI response complete
        const response = event.response as Record<string, unknown> | undefined;
        const output = (response?.output as Array<Record<string, unknown>>)?.[0];
        const content = (output?.content as Array<Record<string, unknown>>)?.[0];
        if (content?.transcript) {
          this.addTranscript({
            role: 'assistant',
            text: content.transcript as string,
            timestamp: new Date(),
          });
        }
        break;
      }

      case 'response.function_call_arguments.done':
        // Function/tool call from AI
        this.handleToolCall({
          id: event.call_id,
          name: event.name,
          arguments: JSON.parse(event.arguments),
        });
        break;

      case 'error':
        logger.error({ callId: this.callId, error: event.error, msg: 'realtime.error' });
        this.emit('error', event.error);
        break;

      default:
        // Log unknown events for debugging
        if (eventType && !eventType.startsWith('rate_limits')) {
          logger.debug({ callId: this.callId, eventType, msg: 'realtime.unknown_event' });
        }
    }
  }

  /**
   * Handle tool call from Realtime API
   */
  private async handleToolCall(toolCall: ToolCall): Promise<void> {
    logger.info({
      callId: this.callId,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      msg: 'realtime.tool_call_received',
    });

    // Execute tool via AGI Bridge
    const result = await this.agiBridge.executeTool(toolCall);

    // Send result back to Realtime API
    if (this.realtimeWs?.readyState === WebSocket.OPEN) {
      this.realtimeWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: result.id,
          output: JSON.stringify(result.error ? { error: result.error } : result.result),
        },
      }));

      // Trigger AI to process the result
      this.realtimeWs.send(JSON.stringify({ type: 'response.create' }));

      logger.info({
        callId: this.callId,
        toolCallId: toolCall.id,
        hasError: !!result.error,
        msg: 'realtime.tool_result_sent',
      });
    }
  }

  private buildDefaultPrompt(): string {
    const agentPrompts: Record<string, string> = {
      jobs_ai: 'You are a friendly jobs assistant helping people find work in Rwanda. Speak clearly and ask about their skills, experience, and job preferences.',
      farmers_ai: 'You are a farmers marketplace assistant. Help farmers sell their produce and buyers find what they need. Ask about quantities, prices, and delivery preferences.',
      real_estate_ai: 'You are a real estate assistant helping people find properties in Rwanda. Ask about location, budget, bedrooms, and other requirements.',
      sales_sdr_ai: 'You are a professional sales representative. Be friendly but efficient. Introduce yourself, explain the offering, and capture the leads interest.',
      waiter_ai: 'You are a restaurant assistant taking orders over the phone. Be friendly, confirm orders clearly, and ask about any special requests.',
      call_center: `You are the EasyMO Call Center AI - the single front-door for all EasyMO services.

CHANNEL: Voice calls (WhatsApp audio and phone)
STYLE: Short, clear, natural voice responses. Keep responses to 1-2 sentences.

SERVICES YOU HANDLE:
- Rides & Delivery - Book moto, car, or bus rides
- Real Estate - Find properties for rent or sale
- Jobs & Employment - Search jobs, register as job seeker
- Marketplace - Farmers market, buy/sell
- Insurance - Health, vehicle, property insurance
- Wallet & Payments - Check balance, transfers, QR payments

CONVERSATION GUIDELINES:
- Warm greeting at start
- Ask one question at a time
- Confirm understanding before taking action
- Use numbered options for clarity
- Mirror caller's language (English, French, Kinyarwanda)

TOOLS: Use the available tools to help users - search knowledge base, book rides, find properties, check wallet balance, etc. Always confirm actions with the user.

Be patient, helpful, and voice-optimized.`,
    };

    return agentPrompts[this.config.agentId] || agentPrompts.call_center;
  }

  private async updateCallStatus(status: string): Promise<void> {
    await this.supabase.from('calls').update({ status }).eq('id', this.callId);
  }
}

/**
 * Session Manager - tracks all active call sessions
 */
export class SessionManager {
  private sessions: Map<string, CallSession> = new Map();

  /**
   * Create a new call session
   */
  async createSession(config: CallSessionConfig): Promise<CallSession> {
    const session = new CallSession(config);
    await session.initialize();
    this.sessions.set(config.callId, session);

    session.on('ended', () => {
      this.sessions.delete(config.callId);
    });

    return session;
  }

  /**
   * Get an existing session
   */
  getSession(callId: string): CallSession | undefined {
    return this.sessions.get(callId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CallSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * End all sessions
   */
  async endAllSessions(): Promise<void> {
    const promises = Array.from(this.sessions.values()).map((session) =>
      session.end('system_shutdown')
    );
    await Promise.all(promises);
  }
}

export const sessionManager = new SessionManager();
