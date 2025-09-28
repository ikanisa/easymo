"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { DataTable } from "@/components/data-table/DataTable";
import type { NotificationOutbox } from "@/lib/schemas";
import styles from "./NotificationsTable.module.css";
import type { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/components/ui/ToastProvider";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NotificationsTableProps {
  initialData: NotificationOutbox[];
}

export function NotificationsTable({ initialData }: NotificationsTableProps) {
  const { data, error, mutate } = useSWR<
    {
      data: NotificationOutbox[];
      integration?: {
        target: string;
        status: "ok" | "degraded";
        reason?: string;
        message?: string;
      };
    }
  >(
    "/api/notifications?limit=200",
    fetcher,
    {
      fallbackData: { data: initialData },
      refreshInterval: 30000,
    },
  );

  const [statusFilter, setStatusFilter] = useState<string>("");
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
  const [pendingAction, setPendingAction] = useState<
    { id: string; action: "cancel" } | null
  >(null);
  const { pushToast } = useToast();

  useEffect(() => {
    if (data?.integration) {
      setIntegration(data.integration);
    }
  }, [data?.integration]);

  const notifications = useMemo(
    () =>
      (data?.data ?? []).filter((
        notification,
      ) => (statusFilter ? notification.status === statusFilter : true)),
    [data?.data, statusFilter],
  );

  const runAction = useCallback(
    async (id: string, action: "resend" | "cancel") => {
      setIsProcessing(true);
      setFeedback(null);
      try {
        const response = await fetch(`/api/notifications/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = await response.json();
        setIntegration((current) => payload?.integration ?? current);
        if (!response.ok) {
          const text = payload?.error ?? `${action} failed`;
          setFeedback(text);
          pushToast(text, "error");
        } else {
          const text = payload.message ?? `${action} applied.`;
          setFeedback(text);
          pushToast(text, "success");
          mutate();
        }
      } catch (err) {
        console.error("Notification action failed", err);
        setFeedback("Unexpected error while updating notification.");
      } finally {
        setIsProcessing(false);
      }
    },
    [mutate, pushToast],
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
    <div className="stack">
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
      />
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="Notifications dispatcher"
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
