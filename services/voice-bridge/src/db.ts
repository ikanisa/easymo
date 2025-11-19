import { createClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
import { config } from "./config";
import { logger } from "./logger";

const client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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
