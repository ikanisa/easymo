import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  addLoanCollateral,
  deleteLoanCollateral,
  fetchBasketsSettings,
  fetchContributions,
  fetchIbimina,
  fetchKycDocuments,
  fetchLoanEvents,
  fetchLoans,
  fetchMemberships,
  fetchReminderLogs,
  fetchSaccoOfficers,
  fetchSaccos,
  fetchUnmatchedSms,
  updateLoan,
} from "@/lib/baskets/baskets-service";
import type {
  BasketsQueryParams,
  BasketsSettings,
  ContributionRow,
  IbiminaMemberRow,
  IbiminaRow,
  KycDocumentRow,
  LoanEvent,
  LoanRow,
  LoanUpdatePayload,
  IkiminaInvitePayload,
  IkiminaInviteResult,
  IkiminaUpdatePayload,
  IkiminaUpdateResponse,
  MomoUnmatchedRow,
  PaginatedResponse,
  ReminderLog,
  SaccoOfficerRow,
  SaccoRow,
} from "@/lib/baskets/baskets-service";

export type {
  BasketsQueryParams,
  BasketsSettings,
  ContributionRow,
  IbiminaMemberRow,
  IbiminaRow,
  IkiminaInvitePayload,
  IkiminaInviteResult,
  IkiminaUpdatePayload,
  IkiminaUpdateResponse,
  KycDocumentRow,
  LoanEvent,
  LoanRow,
  LoanUpdatePayload,
  MomoUnmatchedRow,
  PaginatedResponse,
  ReminderLog,
  SaccoOfficerRow,
  SaccoRow,
} from "@/lib/baskets/baskets-service";

export {
  addLoanCollateral,
  deleteLoanCollateral,
  fetchBasketsSettings,
  fetchContributions,
  fetchIbimina,
  fetchKycDocuments,
  fetchLoanEvents,
  fetchLoans,
  fetchMemberships,
  fetchReminderLogs,
  fetchSaccoOfficers,
  fetchSaccos,
  fetchUnmatchedSms,
  updateLoan,
  updateIkimina,
  updateIkiminaStatus,
  createIkiminaInvite,
} from "@/lib/baskets/baskets-service";

export const basketsQueryKeys = {
  saccos: (
    params: BasketsQueryParams,
  ): QueryKey => ["baskets", "saccos", params],
  ibimina: (
    params: BasketsQueryParams,
  ): QueryKey => ["baskets", "ibimina", params],
  saccoOfficers: (
    params: BasketsQueryParams,
  ): QueryKey => ["baskets", "sacco_officers", params],
  memberships: (
    params: BasketsQueryParams,
  ): QueryKey => ["baskets", "memberships", params],
  unmatchedSms: (
    params: BasketsQueryParams,
  ): QueryKey => ["baskets", "unmatched_sms", params],
  contributions: (
    params: BasketsQueryParams,
  ): QueryKey => ["baskets", "contributions", params],
  kyc: (params: BasketsQueryParams): QueryKey => ["baskets", "kyc", params],
  settings: ["baskets", "settings"] as QueryKey,
  loans: (params: BasketsQueryParams): QueryKey => ["baskets", "loans", params],
};

export function useSaccosQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<SaccoRow>,
    Error,
    PaginatedResponse<SaccoRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.saccos(params),
    queryFn: () => fetchSaccos(params),
    ...options,
  });
}

export function useIbiminaQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<IbiminaRow>,
    Error,
    PaginatedResponse<IbiminaRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.ibimina(params),
    queryFn: () => fetchIbimina(params),
    ...options,
  });
}

export function useSaccoOfficersQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<SaccoOfficerRow>,
    Error,
    PaginatedResponse<SaccoOfficerRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.saccoOfficers(params),
    queryFn: () => fetchSaccoOfficers(params),
    ...options,
  });
}

export function useMembershipsQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<IbiminaMemberRow>,
    Error,
    PaginatedResponse<IbiminaMemberRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.memberships(params),
    queryFn: () => fetchMemberships(params),
    ...options,
  });
}

export function useUnmatchedSmsQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<MomoUnmatchedRow>,
    Error,
    PaginatedResponse<MomoUnmatchedRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.unmatchedSms(params),
    queryFn: () => fetchUnmatchedSms(params),
    ...options,
  });
}

export function useContributionsQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<ContributionRow>,
    Error,
    PaginatedResponse<ContributionRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.contributions(params),
    queryFn: () => fetchContributions(params),
    ...options,
  });
}

export function useKycDocumentsQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<KycDocumentRow>,
    Error,
    PaginatedResponse<KycDocumentRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.kyc(params),
    queryFn: () => fetchKycDocuments(params),
    ...options,
  });
}

export function useBasketsSettings(
  options?: UseQueryOptions<BasketsSettings, Error>,
) {
  return useQuery({
    queryKey: basketsQueryKeys.settings,
    queryFn: fetchBasketsSettings,
    ...options,
  });
}

export function useLoansQuery(
  params: BasketsQueryParams,
  options?: UseQueryOptions<
    PaginatedResponse<LoanRow>,
    Error,
    PaginatedResponse<LoanRow>,
    QueryKey
  >,
) {
  return useQuery({
    queryKey: basketsQueryKeys.loans(params),
    queryFn: () => fetchLoans(params),
    ...options,
  });
}
