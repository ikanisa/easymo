import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import {
  mockOrderEvents,
  mockOrders,
  mockWebhookErrors,
} from "@/lib/mock-data";
import type { Order, OrderEvent, WebhookError } from "@/lib/schemas";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type OrderListParams = Pagination & {
  status?: string;
  barId?: string;
  search?: string;
};

export async function listOrders(
  params: OrderListParams = {},
): Promise<PaginatedResult<Order>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  if (!isServer) {
    const response = await fetchOrdersApi({ ...params, offset, limit });
    if (response.ok) {
      return response.value;
    }
  }

  if (useMocks) {
    const filtered = filterOrders(mockOrders, params);
    return paginateArray(filtered, { offset, limit });
  }

  const response = await fetchOrdersApi({ ...params, offset, limit });
  if (response.ok) {
    return response.value;
  }

  const filtered = filterOrders(mockOrders, params);
  return paginateArray(filtered, { offset, limit });
}

export async function listLatestOrderEvents(
  limit = 10,
): Promise<OrderEvent[]> {
  if (useMocks) {
    return mockOrderEvents.slice(0, limit);
  }

  const url = `${getAdminApiPath("orders", "events")}?limit=${limit}`;
  const response = await apiFetch<{ data: OrderEvent[] }>(url);
  if (response.ok) {
    return response.data.data;
  }

  console.error("Failed to fetch order events", response.error);
  return mockOrderEvents.slice(0, limit);
}

export async function listLatestWebhookErrors(
  limit = 10,
): Promise<WebhookError[]> {
  if (useMocks) {
    return mockWebhookErrors.slice(0, limit);
  }

  const url = `${getAdminApiPath("webhooks", "errors")}?limit=${limit}`;
  const response = await apiFetch<{ data: WebhookError[] }>(url);
  if (response.ok) {
    return response.data.data;
  }

  console.error("Failed to fetch webhook errors", response.error);
  return mockWebhookErrors.slice(0, limit);
}

type OrdersApiResponse = {
  data: Order[];
  total: number;
  hasMore?: boolean;
};

function filterOrders(orders: Order[], params: OrderListParams): Order[] {
  return orders.filter((order) => {
    const statusMatch = params.status ? order.status === params.status : true;
    const barMatch = params.barId ? order.barId === params.barId : true;
    const searchMatch = matchesSearch(
      `${order.id} ${order.barName ?? ""} ${order.table ?? ""}`,
      params.search,
    );
    return statusMatch && barMatch && searchMatch;
  });
}

async function fetchOrdersApi(params: RequiredOrderParams) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit));
  searchParams.set("offset", String(params.offset));
  if (params.status) searchParams.set("status", params.status);
  if (params.barId) searchParams.set("barId", params.barId);
  if (params.search) searchParams.set("search", params.search);

  const response = await apiFetch<OrdersApiResponse>(
    `${getAdminApiPath("orders")}?${searchParams.toString()}`,
  );

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      ok: true as const,
      value: {
        data,
        total,
        hasMore: hasMore ?? (params.offset + data.length < total),
      },
    };
  }

  console.error("Failed to fetch orders", response.error);
  return { ok: false as const };
}

type RequiredOrderParams = OrderListParams & {
  offset: number;
  limit: number;
};
