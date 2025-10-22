"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { DataTable } from "@/components/data-table/DataTable";
import type { NotificationOutbox } from "@/lib/schemas";
import styles from "./NotificationsTable.module.css";
import type { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/components/ui/ToastProvider";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { PolicyBanner } from "@/components/ui/PolicyBanner";
import { getAdminApiPath } from "@/lib/routes";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NotificationsTableProps {
  initialData: NotificationOutbox[];
}

const PAGE_SIZE = 100;

export function NotificationsTable({ initialData }: NotificationsTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");

  const getKey = (pageIndex: number, previousPageData: { data: NotificationOutbox[] } | null) => {
    if (previousPageData && previousPageData.data.length === 0) {
      return null;
    }
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(PAGE_SIZE));
    searchParams.set("offset", String(pageIndex * PAGE_SIZE));
    if (statusFilter) {
      searchParams.set("status", statusFilter);
    }
    return `${getAdminApiPath("notifications")}?${searchParams.toString()}`;
  };

  const {
    data,
    error,
    size,
    setSize,
    mutate: mutatePages,
  } = useSWRInfinite(
    getKey,
    fetcher,
    {
      fallbackData: initialData.length ? [{ data: initialData }] : undefined,
      refreshInterval: 30000,
      revalidateFirstPage: false,
    },
  );

  const [feedback, setFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [integration, setIntegration] = useState<
    {
      target: string;
      status: "ok" | "degraded";
      reason?: string;
      message?: string;
    } | null
  >(null);
  const [policyNotice, setPolicyNotice] = useState<
    { reason: string; message?: string | null } | null
  >(null);
  const [pendingAction, setPendingAction] = useState<
    { id: string; action: "cancel" } | null
  >(null);
  const { pushToast } = useToast();

  const pages = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    const latestIntegration = (() => {
      for (let i = pages.length - 1; i >= 0; i -= 1) {
        const candidate = pages[i]?.integration;
        if (candidate) return candidate;
      }
      return null;
    })();
    setIntegration(latestIntegration);
  }, [pages]);

  useEffect(() => {
    setSize(1);
  }, [statusFilter, setSize]);

  useEffect(() => {
    mutatePages();
  }, [statusFilter, mutatePages]);

  const notifications = useMemo(
    () => pages.flatMap((page) => page?.data ?? []),
    [pages],
  );

  const isLoadingInitial = !data && !error;
  const isLoadingMore = isLoadingInitial
    || (size > 0 && data && typeof data[size - 1] === "undefined");
  const lastPage = pages[pages.length - 1];
  const hasMore = Boolean(lastPage && (lastPage.data?.length ?? 0) === PAGE_SIZE);

  const runAction = useCallback(
    async (id: string, action: "resend" | "cancel") => {
      setIsProcessing(true);
      setFeedback(null);
      setPolicyNotice(null);
      try {
        const response = await fetch(getAdminApiPath("notifications", id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = await response.json();
        setIntegration((current) => payload?.integration ?? current);
        if (!response.ok) {
          if (payload?.reason) {
            setPolicyNotice({
              reason: payload.reason,
              message: payload.message,
            });
            pushToast(
              payload?.message ?? "Action blocked by outbound policy.",
              "info",
            );
            setFeedback(null);
          } else {
            const text = payload?.error ?? `${action} failed`;
            setFeedback(text);
            pushToast(text, "error");
          }
        } else {
          const text = payload.message ?? `${action} applied.`;
          setFeedback(text);
          setPolicyNotice(null);
          pushToast(text, "success");
          mutatePages();
        }
      } catch (err) {
        console.error("Notification action failed", err);
        setFeedback("Unexpected error while updating notification.");
      } finally {
        setIsProcessing(false);
      }
    },
    [mutatePages, pushToast],
  );

  const columns = useMemo<ColumnDef<NotificationOutbox>[]>(
    () => [
      {
        header: "Recipient role",
        accessorKey: "toRole",
      },
      {
        header: "Type",
        accessorKey: "type",
      },
      {
        header: "Status",
        accessorKey: "status",
      },
      {
        header: "Created",
        accessorKey: "createdAt",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        header: "Sent",
        accessorKey: "sentAt",
        cell: (
          { row },
        ) => (row.original.sentAt
          ? new Date(row.original.sentAt).toLocaleString()
          : "—"),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className={styles.actions}>
            <Button
              type="button"
              onClick={() => runAction(row.original.id, "resend")}
              disabled={isProcessing}
              title="Queue this notification again"
              size="sm"
            >
              Resend
            </Button>
            <Button
              type="button"
              onClick={() =>
                setPendingAction({ id: row.original.id, action: "cancel" })}
              disabled={isProcessing}
              title="Cancel this notification"
              size="sm"
              variant="danger"
            >
              Cancel
            </Button>
          </div>
        ),
      },
    ],
    [isProcessing, runAction],
  );

  if (error) {
    return <p>Failed to load notifications.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="filters">
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value || "")}
          >
            <option value="">All</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <DataTable
        data={notifications}
        columns={columns}
        searchPlaceholder="Search notifications"
        globalFilterFn={(row, value) =>
          `${row.type} ${row.toRole}`.toLowerCase().includes(
            value.toLowerCase(),
          )}
        downloadFileName="notifications.csv"
        isLoading={isLoadingInitial}
      />
      <LoadMoreButton
        hasMore={hasMore}
        loading={isLoadingMore}
        onClick={() => setSize(size + 1)}
      >
        Load more notifications
      </LoadMoreButton>
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="Notifications dispatcher"
          />
        )
        : null}
      {policyNotice
        ? (
          <PolicyBanner
            reason={policyNotice.reason}
            message={policyNotice.message}
          />
        )
        : null}
      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
      <ConfirmDialog
        open={pendingAction !== null}
        title="Cancel notification?"
        description="Cancelling prevents further retries for this notification. You can resend manually later."
        confirmLabel="Yes, cancel"
        destructive
        onConfirm={async () => {
          if (pendingAction) {
            await runAction(pendingAction.id, pendingAction.action);
          }
          setPendingAction(null);
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
