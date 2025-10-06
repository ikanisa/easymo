"use client";

import type { IntegrationStatusEntry } from "@/lib/queries/integrations";
import styles from "./IntegrationStatusChip.module.css";

const STATUS_LABELS: Record<IntegrationStatusEntry["status"], string> = {
  green: "Healthy",
  amber: "Degraded",
  red: "Offline",
};

interface IntegrationStatusChipProps {
  label: string;
  status?: IntegrationStatusEntry | null;
  isLoading?: boolean;
}

export function IntegrationStatusChip(
  { label, status, isLoading = false }: IntegrationStatusChipProps,
) {
  const type = status?.status;
  const stateLabel = isLoading
    ? "Checking…"
    : type
    ? STATUS_LABELS[type]
    : "Unknown";
  const message = status?.message ?? "No integration message yet.";
  const badgeClass = type ? styles[`dot_${type}`] : styles.dot_unknown;

  return (
    <div
      className={styles.chip}
      role="status"
      aria-live="polite"
      title={message}
    >
      <span className={`${styles.dot} ${badgeClass}`} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      <span className={styles.state}>{stateLabel}</span>
      <span className="visually-hidden">{message}</span>
    </div>
  );
}
