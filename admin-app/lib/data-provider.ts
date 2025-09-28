import { NAV_ITEMS } from "@/components/layout/nav-items";
import { z } from "zod";
import { getSupabaseClient } from "./supabase-client";
import type {
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

const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";
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

function matchesSearch(haystack: string, needle?: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
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
    return paginateArray(filtered, params);
  }
  // Supabase wiring pending.
  return paginateArray(mockBars, params);
}

export async function listMenuVersions(
  params: { status?: MenuVersion["status"]; barId?: string } & Pagination = {},
): Promise<PaginatedResult<MenuVersion>> {
  if (useMocks) {
    const filtered = mockMenuVersions.filter((menu) => {
      const statusMatch = params.status ? menu.status === params.status : true;
      const barMatch = params.barId ? menu.barId === params.barId : true;
      return statusMatch && barMatch;
    });
    return paginateArray(filtered, params);
  }
  return paginateArray(mockMenuVersions, params);
}

export async function listOcrJobs(
  params: { status?: OcrJob["status"]; barId?: string } & Pagination = {},
): Promise<PaginatedResult<OcrJob>> {
  if (useMocks) {
    const filtered = mockOcrJobs.filter((job) => {
      const statusMatch = params.status ? job.status === params.status : true;
      const barMatch = params.barId ? job.barId === params.barId : true;
      return statusMatch && barMatch;
    });
    return paginateArray(filtered, params);
  }
  return paginateArray(mockOcrJobs, params);
}

export async function listOrders(
  params: { status?: string; barId?: string; search?: string } & Pagination =
    {},
): Promise<PaginatedResult<Order>> {
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
    return paginateArray(filtered, params);
  }
  return paginateArray(mockOrders, params);
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
  const filtered = mockStaffNumbers.filter((item) => {
    const roleMatch = params.role ? item.role === params.role : true;
    const activeMatch = params.active === undefined
      ? true
      : item.active === params.active;
    const barMatch = params.barName ? item.barName === params.barName : true;
    return roleMatch && activeMatch && barMatch;
  });
  return paginateArray(filtered, params);
}

export async function listQrTokens(
  params: Pagination = {},
): Promise<PaginatedResult<QrToken>> {
  return paginateArray(mockQrTokens, params);
}

export async function listTemplates(
  params: Pagination = {},
): Promise<PaginatedResult<TemplateMeta>> {
  return paginateArray(mockTemplates, params);
}

export async function listFlows(
  params: Pagination = {},
): Promise<PaginatedResult<FlowMeta>> {
  return paginateArray(mockFlows, params);
}

export async function listNotifications(
  params: Pagination = {},
): Promise<PaginatedResult<NotificationOutbox>> {
  return paginateArray(mockNotifications, params);
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
  return paginateArray(mockStorageObjects, params);
}

export function getNavOverview() {
  return NAV_ITEMS;
}
