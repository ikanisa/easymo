import { randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { writeAuditEvent } from "../audit/writeAuditEvent";

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("supabase_not_configured");
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export type CreateInviteInput = {
  lead_id: string;
  request_id?: string;
  invite_url_base: string;
  expires_in_days?: number;
};

export async function createVendorOnboardingInvite(input: CreateInviteInput) {
  const client = getClient();
  const expiresInDays = input.expires_in_days ?? 7;
  const inviteCode = randomUUID().replace(/-/g, "").slice(0, 16);
  const inviteUrl = `${input.invite_url_base.replace(/\/$/, "")}/${inviteCode}`;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    lead_id: input.lead_id,
    invite_code: inviteCode,
    invite_url: inviteUrl,
    status: "created",
    expires_at: expiresAt,
  };

  const { data, error } = await client
    .from("vendor_onboarding_invites")
    .insert(payload)
    .select("id, invite_code, invite_url, status, expires_at")
    .single();

  if (error) {
    throw new Error(`vendor_invite_create_failed:${error.message}`);
  }

  await writeAuditEvent({
    request_id: input.request_id,
    event_type: "lead.invite_created",
    actor: "system",
    input: {
      lead_id: input.lead_id,
      invite_url_base: input.invite_url_base,
    },
    output: {
      invite_id: data?.id,
      invite_url: data?.invite_url,
    },
  });

  return data;
}
