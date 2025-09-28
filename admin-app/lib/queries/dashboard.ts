import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { getDashboardSnapshot, listLatestOrderEvents, listLatestWebhookErrors } from '@/lib/data-provider';
import type { TimeseriesPoint, DashboardKpi, OrderEvent, WebhookError } from '@/lib/schemas';

const DASHBOARD_SNAPSHOT_KEY: QueryKey = ['dashboard', 'snapshot'];
const DASHBOARD_ORDER_EVENTS_KEY: QueryKey = ['dashboard', 'order-events'];
const DASHBOARD_WEBHOOK_ERRORS_KEY: QueryKey = ['dashboard', 'webhook-errors'];

export type DashboardSnapshotResult = {
  kpis: DashboardKpi[];
  timeseries: TimeseriesPoint[];
};

export function fetchDashboardSnapshot(): Promise<DashboardSnapshotResult> {
  return getDashboardSnapshot();
}

export function fetchDashboardOrderEvents(): Promise<OrderEvent[]> {
  return Promise.resolve(listLatestOrderEvents());
}

export function fetchDashboardWebhookErrors(): Promise<WebhookError[]> {
  return Promise.resolve(listLatestWebhookErrors());
}

export function useDashboardSnapshotQuery(options?: UseQueryOptions<DashboardSnapshotResult, unknown, DashboardSnapshotResult>) {
  return useQuery({
    queryKey: DASHBOARD_SNAPSHOT_KEY,
    queryFn: fetchDashboardSnapshot,
    ...options
  });
}

export function useDashboardOrderEventsQuery(options?: UseQueryOptions<OrderEvent[], unknown, OrderEvent[]>) {
  return useQuery({
    queryKey: DASHBOARD_ORDER_EVENTS_KEY,
    queryFn: fetchDashboardOrderEvents,
    ...options
  });
}

export function useDashboardWebhookErrorsQuery(options?: UseQueryOptions<WebhookError[], unknown, WebhookError[]>) {
  return useQuery({
    queryKey: DASHBOARD_WEBHOOK_ERRORS_KEY,
    queryFn: fetchDashboardWebhookErrors,
    ...options
  });
}

export const dashboardQueryKeys = {
  snapshot: () => DASHBOARD_SNAPSHOT_KEY,
  orderEvents: () => DASHBOARD_ORDER_EVENTS_KEY,
  webhookErrors: () => DASHBOARD_WEBHOOK_ERRORS_KEY
} as const;
