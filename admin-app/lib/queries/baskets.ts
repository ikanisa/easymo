import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export type BasketsQueryParams = {
  status?: string;
  search?: string;
  saccoId?: string;
  limit?: number;
  offset?: number;
};

export type SaccoRow = {
  id: string;
  name: string;
  branchCode: string;
  umurengeName: string | null;
  district: string | null;
  contactPhone: string | null;
  status: string;
  createdAt: string;
  ltvMinRatio: number;
};

export type IbiminaRow = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: string;
  createdAt: string;
  saccoId: string | null;
  sacco: {
    id: string;
    name: string;
    branchCode: string | null;
  } | null;
  committee: {
    role: string;
    memberId: string;
  }[];
  quorum: {
    threshold: number | null;
    roles: string[];
  } | null;
};

export type SaccoOfficerRow = {
  id: string;
  saccoId: string;
  role: string;
  userId: string;
  createdAt: string;
  sacco: {
    id: string;
    name: string;
    branchCode: string | null;
  } | null;
  profile: {
    userId: string;
    displayName: string | null;
    msisdn: string | null;
  } | null;
};

export type IbiminaMemberRow = {
  id: string;
  ikiminaId: string;
  userId: string;
  status: string;
  joinedAt: string;
  saccoId: string | null;
  ikimina: {
    id: string;
    name: string;
    status: string;
    saccoId: string | null;
  };
  profile: {
    userId: string;
    displayName: string | null;
    msisdn: string | null;
  } | null;
};

export type MomoUnmatchedRow = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  parsed: {
    id: string;
    msisdnE164: string | null;
    senderName: string | null;
    amount: number | null;
    currency: string | null;
    txnId: string | null;
    txnTs: string | null;
  } | null;
};

export type ContributionRow = {
  id: string;
  amount: number;
  currency: string;
  cycle: string;
  allocatedAt: string;
  source: string;
  txnId: string | null;
  meta: Record<string, unknown>;
  ikimina: {
    id: string;
    name: string;
    status: string;
    sacco: {
      id: string;
      name: string;
      branchCode: string | null;
      ltvMinRatio: number | null;
    } | null;
  } | null;
  member: {
    id: string;
    status: string;
    userId: string;
    profile: {
      userId: string;
      displayName: string | null;
      msisdn: string | null;
    } | null;
  } | null;
};

export type KycDocumentRow = {
  id: string;
  userId: string;
  docType: string;
  frontUrl: string;
  backUrl: string | null;
  parsed: Record<string, unknown>;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  profile: {
    displayName: string | null;
    msisdn: string | null;
  } | null;
};

export type BasketsSettings = {
  quietHours: { start: string; end: string } | null;
  templates: Record<string, string> | null;
  featureFlags: {
    module_enabled?: boolean;
    allocator_enabled?: boolean;
    loans_enabled?: boolean;
  } | null;
  reminderThrottle: number | null;
};

export type LoanRow = {
  id: string;
  principal: number;
  currency: string;
  tenureMonths: number;
  rateApr: number | null;
  purpose: string | null;
  status: string;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
  meta: Record<string, unknown>;
  collateralTotal: number;
  ltvRatio: number | null;
  disbursementScheduledAt: string | null;
  disbursedAt: string | null;
  repaymentSchedule: unknown[];
  committeeCompletedAt?: string | null;
  saccoDecisionAt?: string | null;
  saccoDecisionNotes?: string | null;
  saccoDecisionBy?: string | null;
  ikimina: {
    id: string;
    name: string;
    status: string;
    sacco: {
      id: string;
      name: string;
      branchCode: string | null;
    } | null;
  } | null;
  member: {
    id: string;
    status: string;
    userId: string;
    profile: {
      displayName: string | null;
      msisdn: string | null;
    } | null;
  } | null;
  collateral: Array<{
    id: string;
    source: string;
    amount: number;
    coverageRatio: number | null;
    valuation: number | null;
    details: Record<string, unknown>;
  }>;
};

export type LoanEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  actorRole: string | null;
  notes: string | null;
  context: Record<string, unknown>;
  createdAt: string;
};

export type LoanUpdatePayload = {
  status?: LoanRow['status'];
  statusReason?: string | null;
  disbursementScheduledAt?: string | null;
  disbursedAt?: string | null;
  repaymentSchedule?: unknown[];
  saccoDecisionNotes?: string | null;
};

export type ReminderLog = {
  id: string;
  event: string;
  reason: string | null;
  createdAt: string;
  reminderType: string | null;
  reminderStatus: string | null;
  blockedReason: string | null;
  memberName: string | null;
  memberMsisdn: string | null;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
};

export const basketsQueryKeys = {
  saccos: (params: BasketsQueryParams): QueryKey => ['baskets', 'saccos', params],
  ibimina: (params: BasketsQueryParams): QueryKey => ['baskets', 'ibimina', params],
  saccoOfficers: (params: BasketsQueryParams): QueryKey => ['baskets', 'sacco_officers', params],
  memberships: (params: BasketsQueryParams): QueryKey => ['baskets', 'memberships', params],
  unmatchedSms: (params: BasketsQueryParams): QueryKey => ['baskets', 'unmatched_sms', params],
  contributions: (params: BasketsQueryParams): QueryKey => ['baskets', 'contributions', params],
  kyc: (params: BasketsQueryParams): QueryKey => ['baskets', 'kyc', params],
  settings: ['baskets', 'settings'] as QueryKey,
  loans: (params: BasketsQueryParams): QueryKey => ['baskets', 'loans', params],
};

function buildQueryString(params: BasketsQueryParams): string {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.saccoId) searchParams.set('saccoId', params.saccoId);
  if (params.limit != null) searchParams.set('limit', String(params.limit));
  if (params.offset != null) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function fetchSaccos(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<SaccoRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<SaccoRow>>(
    `/api/baskets/saccos${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch SACCO branches');
  }

  return response.data;
}

export async function fetchIbimina(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<IbiminaRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<IbiminaRow>>(
    `/api/baskets/ibimina${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Ibimina');
  }

  return response.data;
}

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

export async function fetchSaccoOfficers(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<SaccoOfficerRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<SaccoOfficerRow>>(
    `/api/baskets/saccos/officers${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch SACCO officers');
  }

  return response.data;
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

export async function fetchMemberships(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<IbiminaMemberRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<IbiminaMemberRow>>(
    `/api/baskets/memberships${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch memberships');
  }

  return response.data;
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

export async function fetchUnmatchedSms(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<MomoUnmatchedRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<MomoUnmatchedRow>>(
    `/api/baskets/momo/unmatched${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch unmatched SMS');
  }

  return response.data;
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

export async function fetchContributions(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<ContributionRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<ContributionRow>>(
    `/api/baskets/contributions${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch contributions ledger');
  }

  return response.data;
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

export async function fetchKycDocuments(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<KycDocumentRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<KycDocumentRow>>(
    `/api/baskets/kyc${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch KYC documents');
  }

  return response.data;
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

export async function fetchBasketsSettings(): Promise<BasketsSettings> {
  const response = await apiFetch<BasketsSettings>(`/api/baskets/settings`);
  if (!response.ok) {
    throw new Error('Failed to fetch Baskets settings');
  }
  return response.data;
}

export function useBasketsSettings(options?: UseQueryOptions<BasketsSettings, Error>) {
  return useQuery({
    queryKey: basketsQueryKeys.settings,
    queryFn: fetchBasketsSettings,
    ...options,
  });
}

export async function fetchLoans(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<LoanRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<LoanRow>>(
    `/api/baskets/loans${query}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch loans');
  }

  return response.data;
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

export async function updateLoan(
  loanId: string,
  payload: LoanUpdatePayload,
): Promise<void> {
  const response = await apiFetch<{ success: boolean }>(`/api/baskets/loans/${loanId}`, {
    method: 'PATCH',
    body: payload,
  });

  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ?? 'Failed to update loan';
    throw new Error(message);
  }
}

type CollateralInput = {
  source: string;
  amount: number;
  coverageRatio?: number | null;
  valuation?: number | null;
  details?: Record<string, unknown>;
};

export async function addLoanCollateral(
  loanId: string,
  payload: CollateralInput,
): Promise<LoanRow['collateral'][number]> {
  const response = await apiFetch<LoanRow['collateral'][number]>(`/api/baskets/loans/${loanId}/collateral`, {
    method: 'POST',
    body: payload,
  });

  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ?? 'Failed to add collateral';
    throw new Error(message);
  }

  return response.data;
}

export async function deleteLoanCollateral(loanId: string, collateralId: string): Promise<void> {
  const response = await apiFetch<{ success: boolean }>(
    `/api/baskets/loans/${loanId}/collateral/${collateralId}`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ?? 'Failed to remove collateral';
    throw new Error(message);
  }
}

export async function fetchLoanEvents(loanId: string): Promise<LoanEvent[]> {
  const response = await apiFetch<{ data: LoanEvent[] }>(`/api/baskets/loans/${loanId}/events`);

  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ?? 'Failed to load loan events';
    throw new Error(message);
  }

  return response.data.data;
}

export async function fetchReminderLogs(): Promise<ReminderLog[]> {
  const response = await apiFetch<{ data: ReminderLog[] }>(`/api/baskets/reminders/logs`);

  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ?? 'Failed to load reminder logs';
    throw new Error(message);
  }

  return response.data.data;
}
