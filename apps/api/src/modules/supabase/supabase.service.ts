import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../common/env';

interface InsertCall {
  from_e164?: string;
  to_e164?: string;
  locale?: string;
  project_id?: string;
  sip_session_id?: string;
  direction: 'inbound' | 'outbound';
  country?: string;
  twilio_call_sid?: string;
  metadata?: Record<string, unknown>;
  agent_profile?: string;
  agent_profile_confidence?: string;
  channel?: 'voice' | 'whatsapp';
  campaign_tags?: string[];
}

interface CreateWaThread {
  call_id?: string;
  wa_conversation_id?: string;
  customer_msisdn: string;
  agent_profile: string;
  agent_display_name: string;
  state?: string;
  metadata?: Record<string, unknown>;
}

interface InsertWaMessage {
  thread_id: string;
  direction: 'user' | 'assistant';
  content: string;
  agent_profile?: string;
  agent_display_name?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SupabaseService {
  public readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false },
    });
  }

  async createCall(data: InsertCall) {
    return this.client.from('voice_calls').insert([data]).select().single();
  }

  async getCallByTwilioSid(twilioCallSid: string) {
    return this.client.from('voice_calls').select('*').eq('twilio_call_sid', twilioCallSid).single();
  }

  async updateCallBySid(twilioCallSid: string, patch: Record<string, unknown>) {
    return this.client.from('voice_calls').update(patch).eq('twilio_call_sid', twilioCallSid);
  }

  async logEvent(callId: string, type: string, payload: unknown) {
    return this.client.from('voice_events').insert([{ call_id: callId, type, payload }]);
  }

  async addTranscript(
    callId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    lang?: string,
  ) {
    return this.client
      .from('transcripts')
      .insert([{ call_id: callId, role, content, lang }]);
  }

  async storeConsent(
    callId: string,
    consentText: string,
    consentResult: boolean,
    audioUrl?: string,
  ) {
    return this.client
      .from('call_consents')
      .insert([{ call_id: callId, consent_text: consentText, consent_result: consentResult, audio_url: audioUrl }]);
  }

  async logMcpToolCall(
    callId: string,
    server: string,
    tool: string,
    args: unknown,
    result: unknown,
    success: boolean,
  ) {
    return this.client
      .from('mcp_tool_calls')
      .insert([{ call_id: callId, server, tool, args, result, success }]);
  }

  async createWaThread(input: CreateWaThread) {
    return this.client
      .from('wa_threads')
      .insert([
        {
          call_id: input.call_id,
          wa_conversation_id: input.wa_conversation_id,
          customer_msisdn: input.customer_msisdn,
          state: input.state ?? 'initiated',
          metadata: input.metadata ?? {},
          agent_profile: input.agent_profile,
          agent_display_name: input.agent_display_name,
        },
      ])
      .select()
      .single();
  }

  async updateWaThread(threadId: string, patch: Record<string, unknown>) {
    return this.client.from('wa_threads').update(patch).eq('id', threadId);
  }

  async getWaThreadById(threadId: string) {
    return this.client.from('wa_threads').select('*').eq('id', threadId).single();
  }

  async logWaMessage(payload: InsertWaMessage) {
    return this.client.from('wa_messages').insert([
      {
        thread_id: payload.thread_id,
        direction: payload.direction,
        content: payload.content,
        metadata: payload.metadata ?? {},
        agent_profile: payload.agent_profile,
        agent_display_name: payload.agent_display_name,
      },
    ]);
  }
}
