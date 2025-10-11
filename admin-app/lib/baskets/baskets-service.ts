import { apiFetch } from "@/lib/api/client";

export type BasketsQueryParams = {
  status?: string;
  search?: string;
  saccoId?: string;
  limit?: number;
  offset?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
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

export type IkiminaUpdatePayload = {
  name?: string;
  description?: string | null;
  status?: IbiminaRow["status"];
  saccoId?: string | null;
  quorum?: {
    threshold: number | null;
    roles: string[];
  };
};

export type IkiminaUpdateResponse = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: IbiminaRow["status"];
  createdAt: string;
  saccoId: string | null;
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
  saccoId: string | null;
  saccoName: string | null;
  borrowerId: string;
  borrowerName: string | null;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueAt: string | null;
  collateral: Array<{
    id: string;
    source: string;
    amount: number;
    coverageRatio: number | null;
    valuation: number | null;
    details: Record<string, unknown> | null;
  }>;
};

export type LoanEvent = {
  id: string;
  loanId: string;
  type: string;
  actor: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type ReminderLog = {
  id: string;
  context: string;
  recipient: string;
  status: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type LoanUpdatePayload = {
  status?: string;
  dueAt?: string | null;
};

type CollateralInput = {
  source: string;
  amount: number;
  coverageRatio?: number | null;
  valuation?: number | null;
  details?: Record<string, unknown>;
};

function buildQueryString(params: BasketsQueryParams): string {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);
  if (params.saccoId) searchParams.set("saccoId", params.saccoId);
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.offset != null) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchSaccos(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<SaccoRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<SaccoRow>>(
    `/api/baskets/saccos${query}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch SACCO branches");
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
    throw new Error("Failed to fetch Ibimina");
  }
  return response.data;
}

export async function updateIkimina(
  ikiminaId: string,
  payload: IkiminaUpdatePayload,
): Promise<IkiminaUpdateResponse> {
  const response = await apiFetch<IkiminaUpdateResponse>(
    `/api/baskets/ibimina/${ikiminaId}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to update Ikimina";
    throw new Error(message);
  }
  return response.data;
}

export function updateIkiminaStatus(
  ikiminaId: string,
  status: IbiminaRow["status"],
): Promise<IkiminaUpdateResponse> {
  return updateIkimina(ikiminaId, { status });
}

export type IkiminaInvitePayload = {
  ikiminaId: string;
  issuerMemberId: string;
  ttlMinutes?: number;
};

export type IkiminaInviteResult = {
  id: string;
  token: string;
  shareCode: string;
  deepLinkUrl: string | null;
  waShareUrl: string | null;
  expiresAt: string;
  status: string;
};

export async function createIkiminaInvite(
  payload: IkiminaInvitePayload,
): Promise<IkiminaInviteResult> {
  const response = await apiFetch<IkiminaInviteResult>(
    "/api/baskets/invites",
    {
      method: "POST",
      body: payload,
    },
  );
  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to create invite";
    throw new Error(message);
  }
  return response.data;
}

export async function fetchSaccoOfficers(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<SaccoOfficerRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<SaccoOfficerRow>>(
    `/api/baskets/saccos/officers${query}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch SACCO officers");
  }
  return response.data;
}

export async function fetchMemberships(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<IbiminaMemberRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<IbiminaMemberRow>>(
    `/api/baskets/memberships${query}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch memberships");
  }
  return response.data;
}

export async function fetchUnmatchedSms(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<MomoUnmatchedRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<MomoUnmatchedRow>>(
    `/api/baskets/momo/unmatched${query}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch unmatched SMS");
  }
  return response.data;
}

export async function fetchContributions(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<ContributionRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<ContributionRow>>(
    `/api/baskets/contributions${query}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch contributions ledger");
  }
  return response.data;
}

export async function fetchKycDocuments(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<KycDocumentRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<KycDocumentRow>>(
    `/api/baskets/kyc${query}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch KYC documents");
  }
  return response.data;
}

export async function fetchBasketsSettings(): Promise<BasketsSettings> {
  const response = await apiFetch<BasketsSettings>(`/api/baskets/settings`);
  if (!response.ok) {
    throw new Error("Failed to fetch Baskets settings");
  }
  return response.data;
}

export async function fetchLoans(
  params: BasketsQueryParams,
): Promise<PaginatedResponse<LoanRow>> {
  const query = buildQueryString(params);
  const response = await apiFetch<PaginatedResponse<LoanRow>>(
    `/api/baskets/loans${query}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch loans");
  }
  return response.data;
}

export async function updateLoan(
  loanId: string,
  payload: LoanUpdatePayload,
): Promise<void> {
  const response = await apiFetch<{ success: boolean }>(
    `/api/baskets/loans/${loanId}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to update loan";
    throw new Error(message);
  }
}

export async function addLoanCollateral(
  loanId: string,
  payload: CollateralInput,
): Promise<LoanRow["collateral"][number]> {
  const response = await apiFetch<LoanRow["collateral"][number]>(
    `/api/baskets/loans/${loanId}/collateral`,
    {
      method: "POST",
      body: payload,
    },
  );
  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to add collateral";
    throw new Error(message);
  }
  return response.data;
}

export async function deleteLoanCollateral(
  loanId: string,
  collateralId: string,
): Promise<void> {
  const response = await apiFetch<{ success: boolean }>(
    `/api/baskets/loans/${loanId}/collateral/${collateralId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to remove collateral";
    throw new Error(message);
  }
}

export async function fetchLoanEvents(loanId: string): Promise<LoanEvent[]> {
  const response = await apiFetch<{ data: LoanEvent[] }>(
    `/api/baskets/loans/${loanId}/events`,
  );
  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to load loan events";
    throw new Error(message);
  }
  return response.data.data;
}

export async function fetchReminderLogs(): Promise<ReminderLog[]> {
  const response = await apiFetch<{ data: ReminderLog[] }>(
    `/api/baskets/reminders/logs`,
  );
  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to load reminder logs";
    throw new Error(message);
  }
  return response.data.data;
}
