import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  getDashboardSnapshot,
  type DashboardSnapshotResult,
} from "@/lib/dashboard/dashboard-service";
import {
  listLatestOrderEvents,
  listLatestWebhookErrors,
} from "@/lib/orders/orders-service";
import type {
  DashboardKpi,
  OrderEvent,
  WebhookError,
} from "@/lib/schemas";

const DASHBOARD_SNAPSHOT_KEY: QueryKey = ["dashboard", "snapshot"];
const DASHBOARD_ORDER_EVENTS_KEY: QueryKey = ["dashboard", "order-events"];
const DASHBOARD_WEBHOOK_ERRORS_KEY: QueryKey = ["dashboard", "webhook-errors"];

export function fetchDashboardSnapshot(): Promise<DashboardSnapshotResult> {
  return getDashboardSnapshot();
}

export function fetchDashboardOrderEvents(): Promise<OrderEvent[]> {
  return listLatestOrderEvents();
}

export function fetchDashboardWebhookErrors(): Promise<WebhookError[]> {
  return listLatestWebhookErrors();
}

export function useDashboardSnapshotQuery(
  options?: UseQueryOptions<
    DashboardSnapshotResult,
    unknown,
    DashboardSnapshotResult
  >,
) {
  return useQuery({
    queryKey: DASHBOARD_SNAPSHOT_KEY,
    queryFn: fetchDashboardSnapshot,
    ...options,
  });
}

export function useDashboardOrderEventsQuery(
  options?: UseQueryOptions<OrderEvent[], unknown, OrderEvent[]>,
) {
  return useQuery({
    queryKey: DASHBOARD_ORDER_EVENTS_KEY,
    queryFn: fetchDashboardOrderEvents,
    ...options,
  });
}

export function useDashboardWebhookErrorsQuery(
  options?: UseQueryOptions<WebhookError[], unknown, WebhookError[]>,
) {
  return useQuery({
    queryKey: DASHBOARD_WEBHOOK_ERRORS_KEY,
    queryFn: fetchDashboardWebhookErrors,
    ...options,
  });
}

export const dashboardQueryKeys = {
  snapshot: () => DASHBOARD_SNAPSHOT_KEY,
  orderEvents: () => DASHBOARD_ORDER_EVENTS_KEY,
  webhookErrors: () => DASHBOARD_WEBHOOK_ERRORS_KEY,
} as const;
