import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildDedupeKey } from "../discovery/dedupeKey";
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

export type EnrichCandidateInput = {
  request_id: string;
  candidate: CandidateVendor;
};

export type EnrichCandidateResult =
  | { kind: "existing_vendor"; vendor_id: string; dedupe_key: string }
  | { kind: "lead"; dedupe_key: string; normalized: CandidateVendor };

export async function enrichVendorCandidate(input: EnrichCandidateInput): Promise<EnrichCandidateResult> {
  const client = getClient();
  const dedupeKey = buildDedupeKey({
    name: input.candidate.name,
    phones: input.candidate.phones,
    website: input.candidate.website,
  });

  const primaryPhone = input.candidate.phones?.[0];
  if (primaryPhone) {
    const { data: vendorByPhone } = await client
      .from("vendors")
      .select("id")
      .eq("phone", primaryPhone)
      .limit(1)
      .maybeSingle();

    if (vendorByPhone?.id) {
      return { kind: "existing_vendor", vendor_id: vendorByPhone.id, dedupe_key: dedupeKey };
    }
  }

  if (input.candidate.website) {
    const { data: leadMatch } = await client
      .from("vendor_leads")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .limit(1)
      .maybeSingle();

    if (leadMatch?.id) {
      return { kind: "lead", dedupe_key: dedupeKey, normalized: input.candidate };
    }
  }

  return { kind: "lead", dedupe_key: dedupeKey, normalized: input.candidate };
}
