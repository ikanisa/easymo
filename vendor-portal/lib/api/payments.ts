// ═══════════════════════════════════════════════════════════════════════════
// Payments API Client
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ManualMatchRequest,
  ManualMatchResponse,
  PaginatedResponse,
} from "@/types/api";
import type {
  Payment,
  PaymentStatus,
  UnmatchedSMS,
} from "@/types/payment";

interface FetchPaymentsParams {
  sacco_id: string;
  status?: PaymentStatus | "all";
  member_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
  sort_by?: "created_at" | "amount" | "status";
  sort_order?: "asc" | "desc";
}

export async function fetchPayments(
  params: FetchPaymentsParams
): Promise<PaginatedResponse<Payment>> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`/api/payments?${searchParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch payments");
  }

  return response.json();
}

export async function fetchPaymentById(id: string): Promise<Payment> {
  const response = await fetch(`/api/payments/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch payment");
  }

  const result = await response.json();
  return result.data;
}

export async function fetchUnmatchedSMS(
  sacco_id: string,
  limit = 50,
  offset = 0
): Promise<PaginatedResponse<UnmatchedSMS>> {
  const searchParams = new URLSearchParams({
    sacco_id,
    limit: String(limit),
    offset: String(offset),
  });

  const response = await fetch(`/api/payments/unmatched?${searchParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch unmatched SMS");
  }

  return response.json();
}

export async function manualMatchPayment(
  request: ManualMatchRequest
): Promise<ManualMatchResponse> {
  const response = await fetch("/api/payments/unmatched", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to match payment");
  }

  return response.json();
}
