import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import { config } from "./config";
import { logger } from "./logger";

const client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ============================================================================
// LEGACY: voice_calls table (existing functionality)
// ============================================================================

export async function insertVoiceCall(payload: {
  to: string;
  from: string;
  agentProfile: string;
  route: string;
  metadata?: Record<string, unknown>;
  consentRequired?: boolean;
  topic?: string;
}): Promise<{ id: string } | PostgrestError> {
  const metadata = {
    ...(payload.metadata ?? {}),
    route: payload.route,
    topic: payload.topic ?? null,
    consent_required: payload.consentRequired ?? false,
  };
  const { data, error } = await client
    .from("voice_calls")
    .insert({
      direction: "outbound",
      status: payload.consentRequired ? "pending_consent" : "in_progress",
      channel: "sip",
      to_e164: payload.to,
      from_e164: payload.from,
      agent_profile: payload.agentProfile,
      metadata,
      started_at: new Date().toISOString(),
      consent_obtained: payload.consentRequired ? false : true,
    })
    .select("id")
    .single();

  if (error) {
    logger.error({ err: error, msg: "voice_call.insert_failed" });
    return error;
  }

  return data;
}

export async function updateConsent(
  callId: string,
  details: {
    recordedAt?: string;
    channel?: string;
    mediaUrl?: string;
  },
): Promise<boolean> {
  const recordedAt = details.recordedAt ?? new Date().toISOString();
  const { error } = await client
    .from("voice_calls")
    .update({
      consent_recorded_at: recordedAt,
      consent_channel: details.channel ?? "ivr",
      consent_media_url: details.mediaUrl ?? null,
      consent_obtained: true,
    })
    .eq("id", callId);

  if (error) {
    logger.error({ err: error, callId, msg: "voice_call.consent_failed" });
    return false;
  }

  const { error: consentError } = await client
    .from("call_consents")
    .insert({
      call_id: callId,
      consent_text: `voice_bridge:${details.channel ?? "ivr"}`,
      consent_result: true,
      audio_url: details.mediaUrl ?? null,
      t: recordedAt,
    });

  if (consentError) {
    logger.warn({ err: consentError, callId, msg: "voice_call.consent_log_failed" });
  }

  return true;
}

export type TranscriptSegment = {
  sequence: number;
  speaker: "caller" | "assistant" | "system";
  text: string;
  confidence?: number;
  startedAt?: string;
  endedAt?: string;
};

export async function insertSegments(
  callId: string,
  segments: TranscriptSegment[],
  locale?: string,
): Promise<boolean> {
  if (!segments.length) return true;
  const rows = segments.map((segment) => ({
    call_id: callId,
    sequence: segment.sequence,
    speaker: segment.speaker,
    text: segment.text,
    confidence: segment.confidence ?? null,
    started_at: segment.startedAt ?? new Date().toISOString(),
    ended_at: segment.endedAt ?? null,
  }));

  const { error } = await client.from("voice_segments").upsert(rows, { onConflict: "call_id,sequence" });

  if (error) {
    logger.error({ err: error, callId, msg: "voice_segments.insert_failed" });
    return false;
  }

  const updatePayload: Record<string, unknown> = {
    last_transcript_segment_at: new Date().toISOString(),
    transcript_status: "ready",
  };
  if (locale) {
    updatePayload.transcript_locale = locale;
  }

  await client
    .from("voice_calls")
    .update(updatePayload)
    .eq("id", callId);

  return true;
}

export async function fetchLiveCalls(limit = 15) {
  const { data, error } = await client
    .from("voice_calls")
    .select("id, to_e164, from_e164, status, agent_profile, started_at, consent_obtained")
    .in("status", ["in_progress", "ringing"])
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ err: error, msg: "voice_call.analytics_failed" });
    throw error;
  }

  return data ?? [];
}

// ============================================================================
// NEW: Call Capability Integration (unified calls table)
// Based on @easymo/call-capability patterns
// ============================================================================

export type CallChannel = "phone" | "whatsapp_call" | "whatsapp_voice_note";
export type CallDirection = "inbound" | "outbound";
export type CallStatus = "initiated" | "in_progress" | "completed" | "abandoned" | "failed";
export type TranscriptRole = "user" | "assistant" | "system";

/**
 * Create a new unified call record
 * Uses the new `calls` table from call-capability schema
 */
export async function createUnifiedCall(payload: {
  userId?: string;
  agentId: string;
  channel: CallChannel;
  direction: CallDirection;
  providerCallId?: string;
  fromNumber?: string;
  toNumber?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string } | PostgrestError> {
  const { data, error } = await client
    .from("calls")
    .insert({
      user_id: payload.userId,
      agent_id: payload.agentId,
      channel: payload.channel,
      direction: payload.direction,
      status: "initiated",
      provider_call_id: payload.providerCallId,
      from_number: payload.fromNumber,
      to_number: payload.toNumber,
      metadata: payload.metadata ?? {},
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    logger.error({ err: error, msg: "calls.create_failed" });
    return error;
  }

  logger.info({ callId: data.id, agentId: payload.agentId, msg: "unified_call.created" });
  return data;
}

/**
 * Update unified call status
 */
export async function updateUnifiedCallStatus(
  callId: string,
  status: CallStatus,
  endCall: boolean = false,
): Promise<boolean> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (endCall) {
    updates.ended_at = new Date().toISOString();
  }

  const { error } = await client
    .from("calls")
    .update(updates)
    .eq("id", callId);

  if (error) {
    logger.error({ err: error, callId, msg: "calls.update_status_failed" });
    return false;
  }

  return true;
}

/**
 * Insert transcript chunk into call_transcripts
 * Replaces segment-by-segment approach with structured chunks
 */
export async function insertTranscriptChunk(
  callId: string,
  chunk: {
    role: TranscriptRole;
    text: string;
    confidence?: number;
    startedAt?: string;
    endedAt?: string;
    raw?: Record<string, unknown>;
  },
): Promise<{ seq: number } | null> {
  // Get next sequence number
  const { data: lastChunk } = await client
    .from("call_transcripts")
    .select("seq")
    .eq("call_id", callId)
    .order("seq", { ascending: false })
    .limit(1)
    .single();

  const nextSeq = (lastChunk?.seq ?? 0) + 1;

  const { data, error } = await client
    .from("call_transcripts")
    .insert({
      call_id: callId,
      seq: nextSeq,
      role: chunk.role,
      text: chunk.text,
      confidence: chunk.confidence,
      started_at: chunk.startedAt ?? new Date().toISOString(),
      ended_at: chunk.endedAt,
      raw: chunk.raw ?? {},
    })
    .select("seq")
    .single();

  if (error) {
    logger.error({ err: error, callId, msg: "call_transcripts.insert_failed" });
    return null;
  }

  return data;
}

/**
 * Batch insert multiple transcript chunks
 */
export async function insertTranscriptChunks(
  callId: string,
  chunks: Array<{
    role: TranscriptRole;
    text: string;
    confidence?: number;
    startedAt?: string;
  }>,
): Promise<boolean> {
  if (!chunks.length) return true;

  // Get current max sequence
  const { data: lastChunk } = await client
    .from("call_transcripts")
    .select("seq")
    .eq("call_id", callId)
    .order("seq", { ascending: false })
    .limit(1)
    .single();

  let seq = (lastChunk?.seq ?? 0) + 1;

  const rows = chunks.map((chunk) => ({
    call_id: callId,
    seq: seq++,
    role: chunk.role,
    text: chunk.text,
    confidence: chunk.confidence,
    started_at: chunk.startedAt ?? new Date().toISOString(),
    raw: {},
  }));

  const { error } = await client.from("call_transcripts").insert(rows);

  if (error) {
    logger.error({ err: error, callId, msg: "call_transcripts.batch_insert_failed" });
    return false;
  }

  return true;
}

/**
 * Save call summary with extracted entities
 */
export async function saveCallSummary(
  callId: string,
  summary: {
    text: string;
    language?: string;
    mainIntent?: string;
    sentiment?: "positive" | "neutral" | "negative" | "mixed";
    entities?: Record<string, unknown>;
    nextActions?: Array<{
      type: string;
      priority: string;
      description: string;
      scheduledFor?: string;
    }>;
  },
): Promise<boolean> {
  // Get call duration
  const { data: call } = await client
    .from("calls")
    .select("started_at, ended_at")
    .eq("id", callId)
    .single();

  let durationSeconds: number | null = null;
  if (call?.started_at && call?.ended_at) {
    durationSeconds = Math.floor(
      (new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000
    );
  }

  // Get word count from transcripts
  const { data: transcripts } = await client
    .from("call_transcripts")
    .select("text")
    .eq("call_id", callId);

  const wordCount = transcripts?.reduce((acc, t) => {
    return acc + (t.text?.split(/\s+/).filter(Boolean).length ?? 0);
  }, 0) ?? 0;

  const { error } = await client.from("call_summaries").upsert({
    call_id: callId,
    summary: summary.text,
    language: summary.language,
    main_intent: summary.mainIntent,
    sentiment: summary.sentiment,
    entities: summary.entities ?? {},
    next_actions: summary.nextActions ?? [],
    duration_seconds: durationSeconds,
    word_count: wordCount,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    logger.error({ err: error, callId, msg: "call_summaries.save_failed" });
    return false;
  }

  logger.info({ callId, intent: summary.mainIntent, msg: "call_summary.saved" });
  return true;
}

/**
 * Get full transcript for a call
 */
export async function getCallTranscript(callId: string): Promise<string> {
  const { data, error } = await client
    .from("call_transcripts")
    .select("role, text")
    .eq("call_id", callId)
    .order("seq", { ascending: true });

  if (error || !data) {
    return "";
  }

  return data.map((chunk) => `${chunk.role}: ${chunk.text}`).join("\n");
}
