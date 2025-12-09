// ═══════════════════════════════════════════════════════════════════════════
// usePayments - React Query hooks for payments
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchPaymentById,
  fetchPayments,
  fetchUnmatchedSMS,
  manualMatchPayment,
} from "@/lib/api/payments";
import type { ManualMatchRequest } from "@/types/api";
import type { PaymentStatus } from "@/types/payment";

interface UsePaymentsParams {
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

export function usePayments(params: UsePaymentsParams) {
  return useQuery({
    queryKey: ["payments", params],
    queryFn: () => fetchPayments(params),
    enabled: !!params.sacco_id,
  });
}

export function usePayment(id: string | null) {
  return useQuery({
    queryKey: ["payment", id],
    queryFn: () => fetchPaymentById(id!),
    enabled: !!id,
  });
}

export function useUnmatchedSMS(sacco_id: string, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["unmatched-sms", sacco_id, limit, offset],
    queryFn: () => fetchUnmatchedSMS(sacco_id, limit, offset),
    enabled: !!sacco_id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useManualMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ManualMatchRequest) => manualMatchPayment(request),
    onSuccess: (data, variables) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["unmatched-sms", variables.sacco_id] });
      queryClient.invalidateQueries({ queryKey: ["payments", { sacco_id: variables.sacco_id }] });
      queryClient.invalidateQueries({ queryKey: ["stats", variables.sacco_id] });
    },
  });
}
