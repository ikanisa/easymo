import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { writeAuditEvent } from "../audit/writeAuditEvent";
import type { CandidateVendor } from "../discovery/types";

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

export type SaveVendorLeadInput = {
  request_id?: string;
  source: string;
  dedupe_key: string;
  candidate: CandidateVendor;
};

export async function saveVendorLead(input: SaveVendorLeadInput) {
  const client = getClient();
  const payload = {
    request_id: input.request_id ?? null,
    source: input.source,
    name: input.candidate.name,
    category_guess: null,
    area: input.candidate.area ?? null,
    address: input.candidate.address ?? null,
    phones: input.candidate.phones,
    website: input.candidate.website ?? null,
    social_links: {},
    confidence: input.candidate.confidence,
    status: "new",
    dedupe_key: input.dedupe_key,
    raw_sources: input.candidate.sources,
  };

  const { data, error } = await client
    .from("vendor_leads")
    .upsert(payload, { onConflict: "dedupe_key" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`vendor_lead_upsert_failed:${error.message}`);
  }

  await writeAuditEvent({
    request_id: input.request_id,
    event_type: "lead.saved",
    actor: "system",
    input: {
      source: input.source,
      dedupe_key: input.dedupe_key,
    },
    output: {
      lead_id: data?.id,
    },
  });

  return data;
}
