export type VoiceDirection = 'inbound' | 'outbound';

export interface VoiceCall {
  id: string;
  direction: VoiceDirection;
  fromE164?: string | null;
  toE164?: string | null;
  locale?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  consentObtained?: boolean | null;
  outcome?: string | null;
  handoff?: boolean | null;
  handoffTarget?: string | null;
  projectId?: string | null;
  sipSessionId?: string | null;
  twilioCallSid?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown> | null;
  agentProfile?: string | null;
  agentProfileConfidence?: string | null;
  channel?: string | null;
  campaignTags?: string[] | null;
}

export interface VoiceTranscript {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  lang?: string | null;
}

export interface VoiceEvent {
  id: string;
  type?: string | null;
  payload: unknown;
  timestamp: string;
}

export interface VoiceToolCall {
  id: string;
  server?: string | null;
  tool?: string | null;
  args?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  timestamp: string;
  success: boolean;
}

export interface VoiceConsent {
  id: string;
  consentText?: string | null;
  consentResult?: boolean | null;
  audioUrl?: string | null;
  timestamp: string;
}

export interface VoiceCallDetails {
  call: VoiceCall;
  transcripts: VoiceTranscript[];
  events: VoiceEvent[];
  toolCalls: VoiceToolCall[];
  consents: VoiceConsent[];
}
