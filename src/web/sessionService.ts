import { childLogger } from "@easymo/commons";
import { getWebSupabaseClient } from "./client";

const log = childLogger({ service: "web-session-service" });

export type WebSessionRecord = {
  id: string;
  anon_user_id: string;
  created_at: string;
  last_seen_at: string;
  language: string;
  device_fingerprint_hash: string | null;
};

export type CreateOrGetSessionInput = {
  anon_user_id: string;
  language?: string;
  device_fingerprint_hash?: string | null;
};

export async function createOrGetSession(input: CreateOrGetSessionInput): Promise<WebSessionRecord> {
  const client = getWebSupabaseClient();
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await client
    .from("web_sessions")
    .select("*")
    .eq("anon_user_id", input.anon_user_id)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    log.warn({ msg: "session_select_failed", error: selectError.message });
    throw new Error(`session_select_failed:${selectError.message}`);
  }

  if (existing) {
    const payload = {
      last_seen_at: now,
      language: input.language ?? existing.language,
      device_fingerprint_hash: input.device_fingerprint_hash ?? existing.device_fingerprint_hash,
    };

    const { data: updated, error: updateError } = await client
      .from("web_sessions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      log.warn({ msg: "session_update_failed", error: updateError.message });
      throw new Error(`session_update_failed:${updateError.message}`);
    }

    return updated as WebSessionRecord;
  }

  const { data: inserted, error: insertError } = await client
    .from("web_sessions")
    .insert({
      anon_user_id: input.anon_user_id,
      language: input.language ?? "en",
      device_fingerprint_hash: input.device_fingerprint_hash ?? null,
    })
    .select("*")
    .single();

  if (insertError) {
    log.warn({ msg: "session_insert_failed", error: insertError.message });
    throw new Error(`session_insert_failed:${insertError.message}`);
  }

  return inserted as WebSessionRecord;
}

export async function getSessionById(sessionId: string): Promise<WebSessionRecord | null> {
  const client = getWebSupabaseClient();
  const { data, error } = await client
    .from("web_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    log.warn({ msg: "session_lookup_failed", error: error.message });
    throw new Error(`session_lookup_failed:${error.message}`);
  }

  return data as WebSessionRecord | null;
}
