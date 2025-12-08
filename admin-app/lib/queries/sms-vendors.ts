import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import {
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";

// ============================================================================
// Types
// ============================================================================

export interface SmsVendor {
  id: string;
  vendorName: string;
  payeeMomoNumber: string;
  whatsappE164: string;
  terminalDeviceId: string | null;
  subscriptionStatus: "pending" | "active" | "suspended" | "expired";
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  apiKey: string;
  hmacSecret: string;
  webhookUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
}

export interface VendorTransaction {
  id: string;
  vendorId: string;
  rawSms: string;
  senderAddress: string | null;
  receivedAt: string | null;
  payerName: string | null;
  payerPhone: string | null;
  amount: number | null;
  currency: string;
  txnId: string | null;
  txnTimestamp: string | null;
  provider: "mtn" | "vodafone" | "airteltigo" | null;
  aiConfidence: number | null;
  parsedJson: Record<string, unknown> | null;
  status: "raw" | "parsed" | "matched" | "error";
  createdAt: string;
  parsedBy: "openai" | "gemini" | "regex" | null;
}

export interface VendorLedger {
  id: string;
  vendorId: string;
  payerPhone: string;
  payerName: string | null;
  totalPaid: number;
  currency: string;
  paymentCount: number;
  firstPaymentAt: string | null;
  lastPaymentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorStats {
  totalTransactions: number;
  totalRevenue: number;
  uniquePayers: number;
  thisMonthRevenue: number;
  thisMonthTransactions: number;
  parserBreakdown: {
    openai: number;
    gemini: number;
    regex: number;
  };
}

export interface VendorReport {
  period: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  totalRevenue: number;
  uniquePayers: number;
  topPayers: Array<{
    payerPhone: string;
    payerName: string | null;
    totalPaid: number;
  }>;
}

// ============================================================================
// Query Parameters
// ============================================================================

export type SmsVendorsQueryParams = Pagination & {
  status?: string;
  search?: string;
};

export type VendorTransactionsQueryParams = Pagination & {
  vendorId: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type VendorLedgersQueryParams = Pagination & {
  vendorId: string;
  search?: string;
};

export type VendorReportsQueryParams = {
  vendorId: string;
  period: "daily" | "weekly" | "monthly";
  startDate?: string;
  endDate?: string;
};

// ============================================================================
// Schemas
// ============================================================================

export const smsVendorSchema = z.object({
  id: z.string().uuid(),
  vendorName: z.string(),
  payeeMomoNumber: z.string(),
  whatsappE164: z.string(),
  terminalDeviceId: z.string().nullable(),
  subscriptionStatus: z.enum(["pending", "active", "suspended", "expired"]),
  subscriptionStartedAt: z.string().nullable(),
  subscriptionExpiresAt: z.string().nullable(),
  apiKey: z.string(),
  hmacSecret: z.string(),
  webhookUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  activatedAt: z.string().nullable(),
});

const vendorsListResponseSchema = z.object({
  data: z.array(smsVendorSchema),
  total: z.number(),
  hasMore: z.boolean().optional(),
});

const vendorResponseSchema = z.object({
  data: smsVendorSchema,
});

// ============================================================================
// Query Keys
// ============================================================================

const ROOT_KEY = ["sms-vendors"] as const;
const TRANSACTIONS_KEY = ["vendor-transactions"] as const;
const LEDGERS_KEY = ["vendor-ledgers"] as const;
const REPORTS_KEY = ["vendor-reports"] as const;

const serializeVendorParams = (params: SmsVendorsQueryParams = {}): SmsVendorsQueryParams => ({
  limit: params.limit ?? 50,
  offset: params.offset ?? 0,
  status: params.status,
  search: params.search,
});

const listKey = (params: SmsVendorsQueryParams): QueryKey => [
  ...ROOT_KEY,
  { params: serializeVendorParams(params) },
];

const detailKey = (id: string): QueryKey => [...ROOT_KEY, id];

const transactionsKey = (params: VendorTransactionsQueryParams): QueryKey => [
  ...TRANSACTIONS_KEY,
  { params },
];

const ledgersKey = (params: VendorLedgersQueryParams): QueryKey => [
  ...LEDGERS_KEY,
  { params },
];

const reportsKey = (params: VendorReportsQueryParams): QueryKey => [
  ...REPORTS_KEY,
  { params },
];

const statsKey = (vendorId: string): QueryKey => [...ROOT_KEY, vendorId, "stats"];

export const smsVendorQueryKeys = {
  all: ROOT_KEY,
  list: (params: SmsVendorsQueryParams = { limit: 50 }) => listKey(params),
  detail: detailKey,
  transactions: transactionsKey,
  ledgers: ledgersKey,
  reports: reportsKey,
  stats: statsKey,
} as const;

// ============================================================================
// API Functions
// ============================================================================

function buildSearchParams(params: Record<string, unknown> = {}): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams;
}

export async function fetchSmsVendors(
  params: SmsVendorsQueryParams = { limit: 50 },
): Promise<PaginatedResult<SmsVendor>> {
  const searchParams = buildSearchParams(serializeVendorParams(params));
  const response = await apiFetch<z.infer<typeof vendorsListResponseSchema>>(
    `${getAdminApiPath("sms-vendors")}?${searchParams.toString()}`,
  );
  const parsed = vendorsListResponseSchema.parse(response);
  return {
    data: parsed.data,
    total: parsed.total,
    hasMore: parsed.hasMore ?? ((params.offset ?? 0) + parsed.data.length < parsed.total),
  };
}

export async function fetchSmsVendor(id: string): Promise<SmsVendor> {
  const response = await apiFetch<z.infer<typeof vendorResponseSchema>>(
    getAdminApiPath("sms-vendors", id),
  );
  const parsed = vendorResponseSchema.parse(response);
  return parsed.data;
}

export async function createSmsVendor(data: {
  vendorName: string;
  payeeMomoNumber: string;
  whatsappE164: string;
  notes?: string;
}): Promise<SmsVendor> {
  const response = await apiFetch<z.infer<typeof vendorResponseSchema>>(
    getAdminApiPath("sms-vendors"),
    {
      method: "POST",
      body: data,
    },
  );
  const parsed = vendorResponseSchema.parse(response);
  return parsed.data;
}

export async function updateSmsVendor(
  id: string,
  data: Partial<{
    vendorName: string;
    payeeMomoNumber: string;
    whatsappE164: string;
    subscriptionStatus: string;
    notes: string;
    webhookUrl: string;
  }>,
): Promise<SmsVendor> {
  const response = await apiFetch<z.infer<typeof vendorResponseSchema>>(
    getAdminApiPath("sms-vendors", id),
    {
      method: "PATCH",
      body: data,
    },
  );
  const parsed = vendorResponseSchema.parse(response);
  return parsed.data;
}

export async function deleteSmsVendor(id: string): Promise<void> {
  await apiFetch(getAdminApiPath("sms-vendors", id), {
    method: "DELETE",
  });
}

export async function regenerateApiKey(id: string): Promise<SmsVendor> {
  const response = await apiFetch<z.infer<typeof vendorResponseSchema>>(
    getAdminApiPath("sms-vendors", id, "regenerate-key"),
    {
      method: "POST",
    },
  );
  const parsed = vendorResponseSchema.parse(response);
  return parsed.data;
}

export async function fetchVendorTransactions(
  params: VendorTransactionsQueryParams,
): Promise<PaginatedResult<VendorTransaction>> {
  const searchParams = buildSearchParams(params);
  const response = await apiFetch<{ data: VendorTransaction[]; total: number; hasMore?: boolean }>(
    `${getAdminApiPath("vendor-transactions")}?${searchParams.toString()}`,
  );
  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? ((params.offset ?? 0) + response.data.length < response.total),
  };
}

export async function fetchVendorLedgers(
  params: VendorLedgersQueryParams,
): Promise<PaginatedResult<VendorLedger>> {
  const searchParams = buildSearchParams(params);
  const response = await apiFetch<{ data: VendorLedger[]; total: number; hasMore?: boolean }>(
    `${getAdminApiPath("vendor-ledgers")}?${searchParams.toString()}`,
  );
  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? ((params.offset ?? 0) + response.data.length < response.total),
  };
}

export async function fetchVendorReports(
  params: VendorReportsQueryParams,
): Promise<VendorReport[]> {
  const searchParams = buildSearchParams(params);
  const response = await apiFetch<{ data: VendorReport[] }>(
    `${getAdminApiPath("vendor-reports")}?${searchParams.toString()}`,
  );
  return response.data;
}

export async function fetchVendorStats(vendorId: string): Promise<VendorStats> {
  const response = await apiFetch<{ data: VendorStats }>(
    getAdminApiPath("sms-vendors", vendorId, "stats"),
  );
  return response.data;
}

// ============================================================================
// Query Hooks
// ============================================================================

export function useSmsVendorsQuery(
  params: SmsVendorsQueryParams = { limit: 50 },
  options?: UseQueryOptions<PaginatedResult<SmsVendor>, unknown, PaginatedResult<SmsVendor>>,
) {
  const queryParams = useMemo(() => serializeVendorParams(params), [params]);
  return useQuery({
    queryKey: smsVendorQueryKeys.list(queryParams),
    queryFn: () => fetchSmsVendors(queryParams),
    ...options,
  });
}

export function useSmsVendorQuery(
  id: string,
  options?: UseQueryOptions<SmsVendor, unknown, SmsVendor>,
) {
  return useQuery({
    queryKey: smsVendorQueryKeys.detail(id),
    queryFn: () => fetchSmsVendor(id),
    enabled: !!id,
    ...options,
  });
}

export function useVendorStatsQuery(
  vendorId: string,
  options?: UseQueryOptions<VendorStats, unknown, VendorStats>,
) {
  return useQuery({
    queryKey: smsVendorQueryKeys.stats(vendorId),
    queryFn: () => fetchVendorStats(vendorId),
    enabled: !!vendorId,
    ...options,
  });
}

export function useVendorTransactionsQuery(
  params: VendorTransactionsQueryParams,
  options?: UseQueryOptions<PaginatedResult<VendorTransaction>, unknown, PaginatedResult<VendorTransaction>>,
) {
  return useQuery({
    queryKey: smsVendorQueryKeys.transactions(params),
    queryFn: () => fetchVendorTransactions(params),
    enabled: !!params.vendorId,
    ...options,
  });
}

export function useVendorLedgersQuery(
  params: VendorLedgersQueryParams,
  options?: UseQueryOptions<PaginatedResult<VendorLedger>, unknown, PaginatedResult<VendorLedger>>,
) {
  return useQuery({
    queryKey: smsVendorQueryKeys.ledgers(params),
    queryFn: () => fetchVendorLedgers(params),
    enabled: !!params.vendorId,
    ...options,
  });
}

export function useVendorReportsQuery(
  params: VendorReportsQueryParams,
  options?: UseQueryOptions<VendorReport[], unknown, VendorReport[]>,
) {
  return useQuery({
    queryKey: smsVendorQueryKeys.reports(params),
    queryFn: () => fetchVendorReports(params),
    enabled: !!params.vendorId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useCreateSmsVendorMutation(
  options?: UseMutationOptions<
    SmsVendor,
    Error,
    { vendorName: string; payeeMomoNumber: string; whatsappE164: string; notes?: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...ROOT_KEY, "create"],
    mutationFn: createSmsVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOT_KEY });
    },
    ...options,
  });
}

export function useUpdateSmsVendorMutation(
  options?: UseMutationOptions<
    SmsVendor,
    Error,
    { id: string; data: Partial<{ vendorName: string; subscriptionStatus: string; notes: string; webhookUrl: string }> }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...ROOT_KEY, "update"],
    mutationFn: ({ id, data }) => updateSmsVendor(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: smsVendorQueryKeys.detail(variables.id) });
    },
    ...options,
  });
}

export function useDeleteSmsVendorMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...ROOT_KEY, "delete"],
    mutationFn: deleteSmsVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOT_KEY });
    },
    ...options,
  });
}

export function useRegenerateApiKeyMutation(
  options?: UseMutationOptions<SmsVendor, Error, string>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...ROOT_KEY, "regenerate-key"],
    mutationFn: regenerateApiKey,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: smsVendorQueryKeys.detail(id) });
    },
    ...options,
  });
}
