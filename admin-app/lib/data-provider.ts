import { NAV_ITEMS } from "@/components/layout/nav-items";
import { z } from "zod";
import { getSupabaseClient } from "./supabase-client";
import { shouldUseMocks } from "./runtime-config";
import type {
  AssistantRun,
  AuditEvent,
  Bar,
  Campaign,
  DashboardKpi,
  FlowMeta,
  InsuranceQuote,
  MenuVersion,
  NotificationOutbox,
  OcrJob,
  Order,
  OrderEvent,
  AdminHubSnapshot,
  AdminVoucherList,
  AdminVoucherDetail,
  AdminDiagnosticsSnapshot,
  AdminDiagnosticsMatch,
  QrToken,
  SettingEntry,
  StaffNumber,
  Station,
  StorageObject,
  TemplateMeta,
  TimeseriesPoint,
  User,
  Voucher,
  WebhookError,
} from "./schemas";
import {
  campaignSchema,
  dashboardKpiSchema,
  assistantRunSchema,
  adminHubSnapshotSchema,
  adminVoucherListSchema,
  adminVoucherDetailSchema,
  adminDiagnosticsSnapshotSchema,
  adminDiagnosticsMatchSchema,
  timeseriesPointSchema,
  userSchema,
  voucherSchema,
} from "./schemas";
import {
  mockAuditEvents,
  mockBars,
  mockCampaigns,
  mockDashboardKpis,
  mockFlows,
  mockInsuranceQuotes,
  mockMenuVersions,
  mockNotifications,
  mockOcrJobs,
  mockOrderEvents,
  mockOrders,
  mockAssistantRuns,
  mockAdminHubSnapshot,
  mockAdminVoucherList,
  mockAdminVoucherDetail,
  mockAdminDiagnostics,
  mockAdminDiagnosticsMatch,
  mockQrTokens,
  mockSettingsEntries,
  mockStaffNumbers,
  mockStations,
  mockStorageObjects,
  mockTemplates,
  mockTimeseries,
  mockUsers,
  mockVouchers,
  mockWebhookErrors,
} from "./mock-data";

export type Pagination = {
  offset?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
};

export type AssistantRequest = {
  promptId: string;
  input?: string;
};

export type AssistantDecisionPayload = {
  suggestionId: string;
  action: "apply" | "dismiss";
  actionId?: string;
  notes?: string;
};

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

function paginateArray<T>(
  items: T[],
  { offset = 0, limit = 25 }: Pagination = {},
): PaginatedResult<T> {
  const slice = items.slice(offset, offset + limit);
  return {
    data: slice,
    total: items.length,
    hasMore: offset + limit < items.length,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchesSearch(haystack: string, needle?: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function getAdminHubSnapshot(): Promise<AdminHubSnapshot> {
  if (useMocks) {
    return mockAdminHubSnapshot;
  }

  try {
    const response = await fetch("/api/admin/hub", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Admin hub request failed with ${response.status}`);
    }
    const json = await response.json();
    return adminHubSnapshotSchema.parse(json);
  } catch (error) {
    console.error("Admin hub fetch failed", error);
    return adminHubSnapshotSchema.parse({
      sections: mockAdminHubSnapshot.sections,
      messages: [
        ...mockAdminHubSnapshot.messages,
        "Failed to load live admin hub sections. Showing mock snapshot instead.",
      ],
    });
  }
}

export async function getAdminVoucherRecent(): Promise<AdminVoucherList> {
  if (useMocks) {
    return mockAdminVoucherList;
  }

  try {
    const response = await fetch("/api/admin/vouchers/recent", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        `Admin voucher recent request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminVoucherListSchema.parse(json);
  } catch (error) {
    console.error("Admin voucher recent fetch failed", error);
    return adminVoucherListSchema.parse({
      vouchers: mockAdminVoucherList.vouchers,
      messages: [
        ...mockAdminVoucherList.messages,
        "Failed to load live vouchers. Showing mock list instead.",
      ],
    });
  }
}

export async function getAdminVoucherDetail(
  voucherId: string,
): Promise<AdminVoucherDetail> {
  if (useMocks) {
    return mockAdminVoucherDetail;
  }

  try {
    const response = await fetch(`/api/admin/vouchers/${voucherId}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        `Admin voucher detail request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminVoucherDetailSchema.parse(json);
  } catch (error) {
    console.error("Admin voucher detail fetch failed", error);
    return adminVoucherDetailSchema.parse({
      ...mockAdminVoucherDetail,
      messages: [
        ...mockAdminVoucherDetail.messages,
        "Failed to load voucher detail. Showing mock data instead.",
      ],
    });
  }
}

export async function getAdminDiagnostics(): Promise<AdminDiagnosticsSnapshot> {
  if (useMocks) {
    return mockAdminDiagnostics;
  }

  try {
    const response = await fetch("/api/admin/diagnostics", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Admin diagnostics request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminDiagnosticsSnapshotSchema.parse(json);
  } catch (error) {
    console.error("Admin diagnostics fetch failed", error);
    return adminDiagnosticsSnapshotSchema.parse({
      health: {
        ...mockAdminDiagnostics.health,
        messages: [
          ...mockAdminDiagnostics.health.messages,
          "Failed to load diagnostics. Showing mock snapshot instead.",
        ],
      },
      logs: {
        ...mockAdminDiagnostics.logs,
        messages: [
          ...mockAdminDiagnostics.logs.messages,
          "Diagnostics logs fallback to mock data.",
        ],
      },
    });
  }
}

export async function getAdminDiagnosticsMatch(
  tripId: string,
): Promise<AdminDiagnosticsMatch> {
  if (useMocks) {
    return mockAdminDiagnosticsMatch;
  }

  try {
    const response = await fetch("/api/admin/diagnostics/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (!response.ok) {
      throw new Error(
        `Diagnostics match request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminDiagnosticsMatchSchema.parse(json);
  } catch (error) {
    console.error("Diagnostics match fetch failed", error);
    return adminDiagnosticsMatchSchema.parse({
      ...mockAdminDiagnosticsMatch,
      messages: [
        ...mockAdminDiagnosticsMatch.messages,
        "Failed to load trip diagnostics. Showing mock data instead.",
      ],
    });
  }
}

export async function listUsers(
  params: { search?: string } & Pagination = {},
): Promise<PaginatedResult<User>> {
  if (!isServer) {
    if (useMocks) {
      const filtered = mockUsers.filter((user) =>
        params.search
          ? matchesSearch(
            `${user.displayName ?? ""} ${user.msisdn}`,
            params.search,
          )
          : true
      );
      return paginateArray(filtered, params);
    }

    try {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.set("search", params.search);
      if (params.offset !== undefined) {
        searchParams.set("offset", String(params.offset));
      }
      if (params.limit !== undefined) {
        searchParams.set("limit", String(params.limit));
      }

      const response = await fetch(`/api/users?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch users from API");
      }
      const json = await response.json();
      return z
        .object({
          data: z.array(userSchema),
          total: z.number(),
          hasMore: z.boolean(),
        })
        .parse(json);
    } catch (error) {
      console.error("Client users fetch failed", error);
      const filtered = mockUsers.filter((user) =>
        params.search
          ? matchesSearch(
            `${user.displayName ?? ""} ${user.msisdn}`,
            params.search,
          )
          : true
      );
      return paginateArray(filtered, params);
    }
  }

  if (useMocks) {
    const filtered = mockUsers.filter((user) =>
      params.search
        ? matchesSearch(
          `${user.displayName ?? ""} ${user.msisdn}`,
          params.search,
        )
        : true
    );
    return paginateArray(filtered, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    const filtered = mockUsers.filter((user) =>
      params.search
        ? matchesSearch(
          `${user.displayName ?? ""} ${user.msisdn}`,
          params.search,
        )
        : true
    );
    return paginateArray(filtered, params);
  }

  const query = adminClient
    .from("users")
    .select(
      `id, msisdn, display_name, locale, roles, status, created_at, last_seen_at`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  if (params.search) {
    query.ilike("msisdn", `%${params.search}%`);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch users from Supabase", error);
    return paginateArray(mockUsers, params);
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      msisdn: item.msisdn,
      displayName: item.display_name,
      locale: item.locale ?? "rw-RW",
      roles: item.roles ?? [],
      status: item.status ?? "active",
      createdAt: item.created_at,
      lastSeenAt: item.last_seen_at,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

export async function listVouchers(
  params: { status?: Voucher["status"]; search?: string } & Pagination = {},
): Promise<PaginatedResult<Voucher>> {
  if (!isServer) {
    if (useMocks) {
      const filtered = mockVouchers.filter((voucher) => {
        const statusMatch = params.status
          ? voucher.status === params.status
          : true;
        const searchMatch = params.search
          ? matchesSearch(
            `${voucher.userName ?? ""} ${voucher.msisdn} ${voucher.id}`,
            params.search,
          )
          : true;
        return statusMatch && searchMatch;
      });
      return paginateArray(filtered, params);
    }

    try {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set("status", params.status);
      if (params.search) searchParams.set("search", params.search);
      if (params.offset !== undefined) {
        searchParams.set("offset", String(params.offset));
      }
      if (params.limit !== undefined) {
        searchParams.set("limit", String(params.limit));
      }

      const response = await fetch(`/api/vouchers?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch vouchers from API");
      }
      const json = await response.json();
      return z
        .object({
          data: z.array(voucherSchema),
          total: z.number(),
          hasMore: z.boolean(),
        })
        .parse(json);
    } catch (error) {
      console.error("Client vouchers fetch failed", error);
      const filtered = mockVouchers.filter((voucher) => {
        const statusMatch = params.status
          ? voucher.status === params.status
          : true;
        const searchMatch = params.search
          ? matchesSearch(
            `${voucher.userName ?? ""} ${voucher.msisdn} ${voucher.id}`,
            params.search,
          )
          : true;
        return statusMatch && searchMatch;
      });
      return paginateArray(filtered, params);
    }
  }

  if (useMocks) {
    const filtered = mockVouchers.filter((voucher) => {
      const statusMatch = params.status
        ? voucher.status === params.status
        : true;
      const searchMatch = params.search
        ? matchesSearch(
          `${voucher.userName ?? ""} ${voucher.msisdn} ${voucher.id}`,
          params.search,
        )
        : true;
      return statusMatch && searchMatch;
    });
    return paginateArray(filtered, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    const filtered = mockVouchers.filter((voucher) => {
      const statusMatch = params.status
        ? voucher.status === params.status
        : true;
      const searchMatch = params.search
        ? matchesSearch(
          `${voucher.userName ?? ""} ${voucher.msisdn} ${voucher.id}`,
          params.search,
        )
        : true;
      return statusMatch && searchMatch;
    });
    return paginateArray(filtered, params);
  }

  const query = adminClient
    .from("vouchers")
    .select(
      `id, user_id, amount, currency, status, campaign_id, station_scope, issued_at, redeemed_at, expires_at,
       users(display_name, msisdn)`,
    )
    .order("issued_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  if (params.status) {
    query.eq("status", params.status);
  }
  if (params.search) {
    query.or(
      `id.ilike.%${params.search}%, users.msisdn.ilike.%${params.search}%`,
    );
  }

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch vouchers from Supabase", error);
    return paginateArray(mockVouchers, params);
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      userName:
        (item.users as { display_name?: string } | null)?.display_name ??
          undefined,
      msisdn: (item.users as { msisdn?: string } | null)?.msisdn ?? "—",
      code: (item as Record<string, unknown>).code5 as string | undefined,
      amount: item.amount ?? 0,
      currency: item.currency ?? "RWF",
      status: item.status as Voucher["status"],
      campaignId: item.campaign_id,
      stationScope: item.station_scope,
      issuedAt: item.issued_at,
      redeemedAt: item.redeemed_at,
      expiresAt: item.expires_at,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

export async function listCampaigns(
  params: Pagination = {},
): Promise<PaginatedResult<Campaign>> {
  if (!isServer) {
    if (useMocks) {
      return paginateArray(mockCampaigns, params);
    }

    try {
      const searchParams = new URLSearchParams();
      if (params.offset !== undefined) {
        searchParams.set("offset", String(params.offset));
      }
      if (params.limit !== undefined) {
        searchParams.set("limit", String(params.limit));
      }

      const response = await fetch(
        `/api/campaigns?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns from API");
      }
      const json = await response.json();
      return z
        .object({
          data: z.array(campaignSchema),
          total: z.number(),
          hasMore: z.boolean(),
        })
        .parse(json);
    } catch (error) {
      console.error("Client campaigns fetch failed", error);
      return paginateArray(mockCampaigns, params);
    }
  }

  if (useMocks) {
    return paginateArray(mockCampaigns, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return paginateArray(mockCampaigns, params);
  }

  const query = adminClient
    .from("campaigns")
    .select(
      "id, name, type, status, template_id, created_at, started_at, metadata",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch campaigns from Supabase", error);
    return paginateArray(mockCampaigns, params);
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type as Campaign["type"],
      status: item.status as Campaign["status"],
      templateId: item.template_id,
      createdAt: item.created_at,
      startedAt: item.started_at,
      finishedAt: item.finished_at,
      metadata: item.metadata ?? {},
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

export async function listInsuranceQuotes(
  params: Pagination = {},
): Promise<PaginatedResult<InsuranceQuote>> {
  if (!isServer && useMocks) {
    return paginateArray(mockInsuranceQuotes, params);
  }

  if (!isServer) {
    // The insurance page currently consumes mock data even in CSR mode.
    return paginateArray(mockInsuranceQuotes, params);
  }

  if (useMocks) {
    return paginateArray(mockInsuranceQuotes, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return paginateArray(mockInsuranceQuotes, params);
  }

  const query = adminClient
    .from("insurance_quotes")
    .select(
      "id, user_id, status, premium, insurer, uploaded_docs, created_at, updated_at, reviewer_comment",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch insurance quotes from Supabase", error);
    return paginateArray(mockInsuranceQuotes, params);
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      status: item.status as InsuranceQuote["status"],
      premium: item.premium,
      insurer: item.insurer,
      uploadedDocs: item.uploaded_docs ?? [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      reviewerComment: item.reviewer_comment ?? null,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

export async function listStations(
  params: Pagination = {},
): Promise<PaginatedResult<Station>> {
  if (!isServer && useMocks) {
    return paginateArray(mockStations, params);
  }

  if (!isServer) {
    return paginateArray(mockStations, params);
  }

  if (useMocks) {
    return paginateArray(mockStations, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return paginateArray(mockStations, params);
  }

  const query = adminClient
    .from("stations")
    .select("id, name, engencode, owner_contact, status, updated_at")
    .order("name", { ascending: true })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch stations from Supabase", error);
    return paginateArray(mockStations, params);
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      name: item.name,
      engencode: item.engencode,
      ownerContact: item.owner_contact,
      status: item.status as Station["status"],
      location: null,
      updatedAt: item.updated_at,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

export async function getDashboardSnapshot(): Promise<{
  kpis: DashboardKpi[];
  timeseries: TimeseriesPoint[];
}> {
  if (!isServer) {
    if (useMocks) {
      return {
        kpis: mockDashboardKpis,
        timeseries: mockTimeseries,
      };
    }
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard snapshot from API");
      }
      const json = await response.json();
      return z
        .object({
          kpis: z.array(dashboardKpiSchema),
          timeseries: z.array(timeseriesPointSchema),
        })
        .parse(json);
    } catch (error) {
      console.error("Client dashboard fetch failed", error);
      return {
        kpis: mockDashboardKpis,
        timeseries: mockTimeseries,
      };
    }
  }

  if (useMocks) {
    return {
      kpis: mockDashboardKpis,
      timeseries: mockTimeseries,
    };
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      kpis: mockDashboardKpis,
      timeseries: mockTimeseries,
    };
  }

  const { data, error } = await adminClient.rpc("dashboard_snapshot");

  if (error || !data) {
    console.error("Failed to fetch dashboard snapshot from Supabase", error);
    return {
      kpis: mockDashboardKpis,
      timeseries: mockTimeseries,
    };
  }

  return data as { kpis: DashboardKpi[]; timeseries: TimeseriesPoint[] };
}

export async function listBars(
  params: { search?: string; active?: boolean } & Pagination = {},
): Promise<PaginatedResult<Bar>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  const status = params.active === undefined
    ? undefined
    : (params.active ? "active" : "inactive");

  if (!isServer) {
    const { fetchBars } = await import("@/lib/queries/bars");
    return fetchBars({
      limit,
      offset,
      search: params.search,
      status,
    });
  }

  if (useMocks) {
    const filtered = mockBars.filter((bar) => {
      const statusMatch = params.active === undefined
        ? true
        : bar.isActive === params.active;
      const searchMatch = matchesSearch(
        `${bar.name} ${bar.location ?? ""}`,
        params.search,
      );
      return statusMatch && searchMatch;
    });
    return paginateArray(filtered, { offset, limit });
  }

  const { fetchBars } = await import("@/lib/queries/bars");
  return fetchBars({
    limit,
    offset,
    search: params.search,
    status,
  });
}

export async function listMenuVersions(
  params: { status?: MenuVersion["status"]; barId?: string } & Pagination = {},
): Promise<PaginatedResult<MenuVersion>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  const applyFilter = (collection: MenuVersion[]) => {
    return collection.filter((menu) => {
      const statusMatch = params.status ? menu.status === params.status : true;
      const barMatch = params.barId ? menu.barId === params.barId : true;
      return statusMatch && barMatch;
    });
  };

  if (!isServer) {
    return paginateArray(applyFilter(mockMenuVersions), { offset, limit });
  }

  if (useMocks) {
    return paginateArray(applyFilter(mockMenuVersions), { offset, limit });
  }

  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return paginateArray(applyFilter(mockMenuVersions), { offset, limit });
  }

  const query = adminClient
    .from("menus")
    .select(
      `id, bar_id, version, status, source, updated_at, created_at,
       bars:bars(name),
       categories:categories(count),
       items:items(count)` ,
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    query.eq("status", params.status);
  }
  if (params.barId) {
    query.eq("bar_id", params.barId);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch menu versions from Supabase", error);
    return paginateArray(applyFilter(mockMenuVersions), { offset, limit });
  }

  const items = data.map((row) => {
    const categoryCount = Array.isArray(row.categories) && row.categories.length
      ? Number(row.categories[0]?.count ?? 0)
      : 0;
    const itemCount = Array.isArray(row.items) && row.items.length
      ? Number(row.items[0]?.count ?? 0)
      : 0;

    return {
      id: row.id,
      barId: row.bar_id,
      barName: row.bars?.name ?? "Unknown bar",
      version: `v${row.version ?? 1}`,
      status: row.status ?? "draft",
      source: row.source ?? "manual",
      categories: categoryCount,
      items: itemCount,
      updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    } satisfies MenuVersion;
  });

  return {
    data: items,
    total: count ?? items.length,
    hasMore: offset + items.length < (count ?? items.length),
  };
}

export async function listOcrJobs(
  params: { status?: OcrJob["status"]; barId?: string } & Pagination = {},
): Promise<PaginatedResult<OcrJob>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  const applyFilter = (collection: OcrJob[]) => {
    return collection.filter((job) => {
      const statusMatch = params.status ? job.status === params.status : true;
      const barMatch = params.barId ? job.barId === params.barId : true;
      return statusMatch && barMatch;
    });
  };

  if (!isServer) {
    return paginateArray(applyFilter(mockOcrJobs), { offset, limit });
  }

  if (useMocks) {
    return paginateArray(applyFilter(mockOcrJobs), { offset, limit });
  }

  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return paginateArray(applyFilter(mockOcrJobs), { offset, limit });
  }

  const query = adminClient
    .from("ocr_jobs")
    .select(
      `id, bar_id, menu_id, source_file_id, status, error_message, attempts, created_at, updated_at,
       bars:bars(name)` ,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    query.eq("status", params.status);
  }
  if (params.barId) {
    query.eq("bar_id", params.barId);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch OCR jobs from Supabase", error);
    return paginateArray(applyFilter(mockOcrJobs), { offset, limit });
  }

  const items = data.map((row) => {
    const fileName = row.source_file_id ?? "menu";
    const extension = fileName.split(".").pop()?.toLowerCase();
    const type: OcrJob["type"] = extension === "pdf" ? "pdf" : "image";

    return {
      id: row.id,
      barId: row.bar_id,
      barName: row.bars?.name ?? "Unknown bar",
      fileName,
      type,
      status: row.status ?? "queued",
      durationSeconds: null,
      retries: row.attempts ?? 0,
      submittedAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    } satisfies OcrJob;
  });

  return {
    data: items,
    total: count ?? items.length,
    hasMore: offset + items.length < (count ?? items.length),
  };
}

export async function listOrders(
  params: { status?: string; barId?: string; search?: string } & Pagination =
    {},
): Promise<PaginatedResult<Order>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  if (!isServer) {
    return import("@/lib/queries/orders").then(({ fetchOrders }) =>
      fetchOrders({
        status: params.status,
        barId: params.barId,
        offset,
        limit,
      })
    );
  }

  if (useMocks) {
    const filtered = mockOrders.filter((order) => {
      const statusMatch = params.status ? order.status === params.status : true;
      const barMatch = params.barId ? order.barId === params.barId : true;
      const searchMatch = matchesSearch(
        `${order.id} ${order.barName} ${order.table ?? ""}`,
        params.search,
      );
      return statusMatch && barMatch && searchMatch;
    });
    return paginateArray(filtered, { offset, limit });
  }

  const { fetchOrders } = await import("@/lib/queries/orders");
  return fetchOrders({
    status: params.status,
    barId: params.barId,
    offset,
    limit,
  });
}

export function listLatestOrderEvents(limit = 10): OrderEvent[] {
  return mockOrderEvents.slice(0, limit);
}

export function listLatestWebhookErrors(limit = 10): WebhookError[] {
  return mockWebhookErrors.slice(0, limit);
}

export async function listStaffNumbers(
  params: { role?: string; active?: boolean; barName?: string } & Pagination =
    {},
): Promise<PaginatedResult<StaffNumber>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  if (!isServer) {
    const { fetchStaffNumbers } = await import("@/lib/queries/staffNumbers");
    return fetchStaffNumbers({
      limit,
      offset,
      search: params.barName,
      role: params.role,
      active: params.active,
    });
  }

  if (useMocks) {
    const filtered = mockStaffNumbers.filter((item) => {
      const roleMatch = params.role ? item.role === params.role : true;
      const activeMatch = params.active === undefined
        ? true
        : item.active === params.active;
      const barMatch = params.barName ? item.barName === params.barName : true;
      return roleMatch && activeMatch && barMatch;
    });
    return paginateArray(filtered, { offset, limit });
  }

  const { fetchStaffNumbers } = await import("@/lib/queries/staffNumbers");
  return fetchStaffNumbers({
    limit,
    offset,
    search: params.barName,
    role: params.role,
    active: params.active,
  });
}

export async function listQrTokens(
  params: Pagination = {},
): Promise<PaginatedResult<QrToken>> {
  if (!isServer && useMocks) {
    return paginateArray(mockQrTokens, params);
  }

  if (!isServer) {
    return paginateArray(mockQrTokens, params);
  }

  if (useMocks) {
    return paginateArray(mockQrTokens, params);
  }

  const { fetchQrTokens } = await import('@/lib/queries/qr');
  return fetchQrTokens({ limit: params.limit ?? 100, offset: params.offset ?? 0 });
}

export async function listTemplates(
  params: { status?: TemplateMeta["status"] } & Pagination = {},
): Promise<PaginatedResult<TemplateMeta>> {
  const filtered = mockTemplates.filter((template) =>
    params.status ? template.status === params.status : true
  );
  return paginateArray(filtered, params);
}

export async function listFlows(
  params: { status?: FlowMeta["status"] } & Pagination = {},
): Promise<PaginatedResult<FlowMeta>> {
  const filtered = mockFlows.filter((flow) =>
    params.status ? flow.status === params.status : true
  );
  return paginateArray(filtered, params);
}

export async function listNotifications(
  params: Pagination = {},
): Promise<PaginatedResult<NotificationOutbox>> {
  if (!isServer && useMocks) {
    return paginateArray(mockNotifications, params);
  }

  if (!isServer) {
    return paginateArray(mockNotifications, params);
  }

  if (useMocks) {
    return paginateArray(mockNotifications, params);
  }

  const { fetchNotifications } = await import('@/lib/queries/notifications');
  return fetchNotifications({ limit: params.limit ?? 100, offset: params.offset ?? 0 });
}

export async function listAuditEvents(
  params: Pagination = {},
): Promise<PaginatedResult<AuditEvent>> {
  return paginateArray(mockAuditEvents, params);
}

export async function listSettingsPreview(
  params: Pagination = {},
): Promise<PaginatedResult<SettingEntry>> {
  return paginateArray(mockSettingsEntries, params);
}

export async function listStorageObjects(
  params: Pagination = {},
): Promise<PaginatedResult<StorageObject>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  if (!isServer) {
    const { fetchStorageObjects } = await import("@/lib/queries/files");
    return fetchStorageObjects({ offset, limit });
  }

  if (useMocks) {
    return paginateArray(mockStorageObjects, { offset, limit });
  }

  const { fetchStorageObjects } = await import("@/lib/queries/files");
  return fetchStorageObjects({ offset, limit });
}

export async function requestAssistantSuggestion(
  request: AssistantRequest,
): Promise<AssistantRun> {
  const payload = {
    promptId: request.promptId,
    input: request.input ?? null,
  };

  if (!isServer && !useMocks) {
    try {
      const response = await fetch("/api/assistant/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const json = await response.json();
        return assistantRunSchema.parse(json);
      }
    } catch (error) {
      console.warn("assistant.fetch_failed", error);
    }
  }

  await delay(350);

  const base = mockAssistantRuns.find((run) => run.promptId === request.promptId)
    ?? mockAssistantRuns.find((run) => run.promptId === "freeform.query")
    ?? mockAssistantRuns[0];

  const stamp = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(-5);
  const clonedSuggestion = {
    ...base.suggestion,
    id: `${base.suggestion.id}-${suffix}`,
    generatedAt: stamp,
  };

  const clonedMessages = base.messages.map((message, idx) => ({
    ...message,
    id: `${message.id}-${suffix}-${idx}`,
    createdAt: stamp,
  }));

  if (request.input && request.promptId === "freeform.query") {
    clonedMessages.push({
      id: `assistant-freeform-echo-${suffix}`,
      role: "assistant",
      content: `Captured prompt: “${request.input}”. Replace me with real analysis when the API ships.`,
      createdAt: stamp,
    });
  }

  return {
    promptId: request.promptId,
    suggestion: clonedSuggestion,
    messages: clonedMessages,
  };
}

export async function logAssistantDecision(
  payload: AssistantDecisionPayload,
): Promise<{ status: "ok" }> {
  if (!isServer && !useMocks) {
    try {
      const response = await fetch("/api/audit/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "assistant",
          suggestionId: payload.suggestionId,
          action: payload.action,
          actionId: payload.actionId ?? null,
          notes: payload.notes ?? null,
        }),
      });
      if (response.ok) {
        return { status: "ok" };
      }
    } catch (error) {
      console.warn("assistant.log_failed", error);
    }
  }

  await delay(200);
  console.info("assistant.log_mock", payload);
  return { status: "ok" };
}

export function getNavOverview() {
  return NAV_ITEMS;
}
