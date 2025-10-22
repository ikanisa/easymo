import { supabase } from '@/integrations/supabase/client';
import type {
  VoiceCall,
  VoiceCallDetails,
  VoiceConsent,
  VoiceEvent,
  VoiceToolCall,
  VoiceTranscript,
} from './types';

export class VoiceDataError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'VoiceDataError';
    this.cause = options?.cause;
  }
}

const client = supabase as unknown as {
  from: typeof supabase.from;
};

const CALL_FIELDS = [
  'id',
  'direction',
  'from_e164',
  'to_e164',
  'locale',
  'started_at',
  'ended_at',
  'duration_seconds',
  'consent_obtained',
  'outcome',
  'handoff',
  'handoff_target',
  'project_id',
  'sip_session_id',
  'twilio_call_sid',
  'country',
  'metadata',
  'agent_profile',
  'agent_profile_confidence',
  'channel',
  'campaign_tags',
] as const;

type RawVoiceCall = Record<(typeof CALL_FIELDS)[number], any> & { [key: string]: any };

type RawTranscript = {
  id: string;
  call_id: string;
  role: string;
  content: string | null;
  t: string;
  lang?: string | null;
};

type RawEvent = {
  id: string;
  call_id: string;
  type?: string | null;
  payload?: unknown;
  t: string;
};

type RawToolCall = {
  id: string;
  call_id: string;
  server?: string | null;
  tool?: string | null;
  args?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  t: string;
  success?: boolean | null;
};

type RawConsent = {
  id: string;
  call_id: string;
  consent_text?: string | null;
  consent_result?: boolean | null;
  audio_url?: string | null;
  t: string;
};

const toVoiceCall = (row: RawVoiceCall): VoiceCall => {
  const parseMetadata = (metadata: unknown): Record<string, unknown> | null => {
    if (!metadata) {
      return null;
    }
    if (typeof metadata === 'object') {
      return metadata as Record<string, unknown>;
    }
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return { raw: metadata };
      }
    }
    return null;
  };

  return {
    id: row.id,
    direction: row.direction === 'outbound' ? 'outbound' : 'inbound',
    fromE164: row.from_e164 ?? null,
    toE164: row.to_e164 ?? null,
    locale: row.locale ?? null,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    durationSeconds: typeof row.duration_seconds === 'number' ? row.duration_seconds : null,
    consentObtained: typeof row.consent_obtained === 'boolean' ? row.consent_obtained : null,
    outcome: row.outcome ?? null,
    handoff: typeof row.handoff === 'boolean' ? row.handoff : null,
    handoffTarget: row.handoff_target ?? null,
    projectId: row.project_id ?? null,
    sipSessionId: row.sip_session_id ?? null,
    twilioCallSid: row.twilio_call_sid ?? null,
    country: row.country ?? null,
    metadata: parseMetadata(row.metadata),
    agentProfile: row.agent_profile ?? null,
    agentProfileConfidence: row.agent_profile_confidence ?? null,
    channel: row.channel ?? null,
    campaignTags: Array.isArray(row.campaign_tags) ? row.campaign_tags : null,
  };
};

const toTranscript = (row: RawTranscript): VoiceTranscript => ({
  id: row.id,
  role: row.role === 'assistant' || row.role === 'system' ? (row.role as 'assistant' | 'system') : 'user',
  content: row.content ?? '',
  timestamp: row.t,
  lang: row.lang ?? null,
});

const toEvent = (row: RawEvent): VoiceEvent => ({
  id: row.id,
  type: row.type ?? null,
  payload: row.payload ?? null,
  timestamp: row.t,
});

const toToolCall = (row: RawToolCall): VoiceToolCall => ({
  id: row.id,
  server: row.server ?? null,
  tool: row.tool ?? null,
  args: row.args ?? null,
  result: row.result ?? null,
  timestamp: row.t,
  success: row.success ?? false,
});

const toConsent = (row: RawConsent): VoiceConsent => ({
  id: row.id,
  consentText: row.consent_text ?? null,
  consentResult: typeof row.consent_result === 'boolean' ? row.consent_result : null,
  audioUrl: row.audio_url ?? null,
  timestamp: row.t,
});

export async function listVoiceCalls(options?: { limit?: number; profile?: string | null }): Promise<VoiceCall[]> {
  try {
    const { limit = 40, profile } = options ?? {};
    let query = client
      .from('voice_calls')
      .select(CALL_FIELDS.join(','))
      .order('started_at', { ascending: false })
      .limit(limit);

    if (profile) {
      query = query.eq('agent_profile', profile);
    }

    const { data, error } = await query;
    if (error) {
      throw new VoiceDataError(`Failed to load voice calls: ${error.message}`, { cause: error });
    }

    return (data ?? []).map((row) => toVoiceCall(row as RawVoiceCall));
  } catch (err) {
    if (err instanceof VoiceDataError) {
      throw err;
    }
    throw new VoiceDataError('Unable to retrieve voice calls from Supabase', { cause: err });
  }
}

export async function getVoiceCallDetails(callId: string): Promise<VoiceCallDetails> {
  try {
    const [callRes, transcriptsRes, eventsRes, toolRes, consentsRes] = await Promise.all([
      client
        .from('voice_calls')
        .select(CALL_FIELDS.join(','))
        .eq('id', callId)
        .maybeSingle(),
      client
        .from('transcripts')
        .select('id, call_id, role, content, t, lang')
        .eq('call_id', callId)
        .order('t', { ascending: true }),
      client
        .from('voice_events')
        .select('id, call_id, type, payload, t')
        .eq('call_id', callId)
        .order('t', { ascending: true }),
      client
        .from('mcp_tool_calls')
        .select('id, call_id, server, tool, args, result, t, success')
        .eq('call_id', callId)
        .order('t', { ascending: true }),
      client
        .from('call_consents')
        .select('id, call_id, consent_text, consent_result, audio_url, t')
        .eq('call_id', callId)
        .order('t', { ascending: true }),
    ]);

    if (callRes.error) {
      throw new VoiceDataError(`Failed to load call ${callId}: ${callRes.error.message}`, { cause: callRes.error });
    }

    if (!callRes.data) {
      throw new VoiceDataError(`Voice call ${callId} not found`);
    }

    return {
      call: toVoiceCall(callRes.data as RawVoiceCall),
      transcripts: (transcriptsRes.data ?? []).map((row) => toTranscript(row as RawTranscript)),
      events: (eventsRes.data ?? []).map((row) => toEvent(row as RawEvent)),
      toolCalls: (toolRes.data ?? []).map((row) => toToolCall(row as RawToolCall)),
      consents: (consentsRes.data ?? []).map((row) => toConsent(row as RawConsent)),
    };
  } catch (err) {
    if (err instanceof VoiceDataError) {
      throw err;
    }
    throw new VoiceDataError(`Unable to load voice call ${callId}`, { cause: err });
  }
}
