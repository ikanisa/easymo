"use client";

import { useMemo } from "react";
import { useTranslation } from "@/providers/i18n-provider";

interface NotificationRow {
  id: string;
  event: string;
  sacco_id: string | null;
  template_id: string | null;
  status: string | null;
  scheduled_for: string | null;
  created_at: string | null;
  channel?: string | null;
}

interface NotificationQueueTableProps {
  rows: NotificationRow[];
  saccoLookup: Map<string, string>;
  templateLookup: Map<string, string>;
}

export function NotificationQueueTable({
  rows,
  saccoLookup,
  templateLookup,
}: NotificationQueueTableProps) {
  const { t } = useTranslation();
  const emptyState = rows.length === 0;
  const formatted = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        saccoLabel: row.sacco_id
          ? (saccoLookup.get(row.sacco_id) ?? row.sacco_id)
          : t("sacco.all", "All SACCOs"),
        templateLabel: row.template_id
          ? (templateLookup.get(row.template_id) ?? row.template_id)
          : "—",
        createdLabel: row.created_at
          ? new Intl.DateTimeFormat("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "UTC",
            }).format(new Date(row.created_at))
          : "—",
        scheduledLabel: row.scheduled_for
          ? new Intl.DateTimeFormat("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "UTC",
            }).format(new Date(row.scheduled_for))
          : "—",
        channelLabel: row.channel ?? "—",
      })),
    [rows, saccoLookup, templateLookup, t]
  );

  if (emptyState) {
    return (
      <p className="text-sm text-gray-600">
        {t("admin.queue.empty", "No notifications queued yet.")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.2em] text-gray-600">
          <tr>
            <th className="px-4 py-3">{t("admin.queue.event", "Event")}</th>
            <th className="px-4 py-3">{t("admin.queue.channel", "Channel")}</th>
            <th className="px-4 py-3">{t("admin.queue.sacco", "SACCO")}</th>
            <th className="px-4 py-3">{t("admin.queue.template", "Template")}</th>
            <th className="px-4 py-3">{t("table.status", "Status")}</th>
            <th className="px-4 py-3">{t("admin.queue.queued", "Queued")}</th>
            <th className="px-4 py-3">{t("admin.queue.scheduled", "Scheduled")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {formatted.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 font-medium">{row.event}</td>
              <td className="px-4 py-3 text-gray-700">{row.channelLabel ?? "—"}</td>
              <td className="px-4 py-3 text-gray-700">{row.saccoLabel}</td>
              <td className="px-4 py-3 text-gray-700">{row.templateLabel}</td>
              <td className="px-4 py-3 text-gray-700">{row.status ?? "pending"}</td>
              <td className="px-4 py-3 text-gray-700">{row.createdLabel}</td>
              <td className="px-4 py-3 text-gray-700">{row.scheduledLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
