import { z } from "zod";

import {
  parseArray,
  requireSupabaseAdminClient,
  SupabaseQueryError,
} from "./utils";

const candidateRow = z.object({
  quote_id: z.string().uuid(),
  session_id: z.string().uuid(),
  vendor_type: z.string(),
  vendor_name: z.string().nullable(),
  vendor_phone: z.string().nullable(),
  status: z.string(),
  price_amount: z.number().nullable(),
  price_currency: z.string().nullable(),
  estimated_time_minutes: z.number().nullable(),
  notes: z.string().nullable(),
  offer_data: z.record(z.any()),
  responded_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type NegotiationCandidateRow = z.infer<typeof candidateRow>;

export type NegotiationCandidate = {
  quoteId: string;
  sessionId: string;
  vendorType: string;
  vendorName: string | null;
  vendorPhone: string | null;
  status: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  estimatedTimeMinutes: number | null;
  notes: string | null;
  offerData: Record<string, unknown>;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toCandidate(row: NegotiationCandidateRow): NegotiationCandidate {
  return {
    quoteId: row.quote_id,
    sessionId: row.session_id,
    vendorType: row.vendor_type,
    vendorName: row.vendor_name,
    vendorPhone: row.vendor_phone,
    status: row.status,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    estimatedTimeMinutes: row.estimated_time_minutes,
    notes: row.notes,
    offerData: row.offer_data,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCandidatesForSession(sessionId: string) {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("negotiation_candidates_v")
    .select("*")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new SupabaseQueryError(error.message);
  }

  return parseArray(candidateRow, data ?? []).map(toCandidate);
}
