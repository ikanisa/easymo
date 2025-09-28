import styles from "./IntegrationStatusBadge.module.css";

interface IntegrationStatus {
  target: string;
  status: "ok" | "degraded";
  reason?: string;
  message?: string;
}

interface IntegrationStatusBadgeProps {
  integration?: IntegrationStatus | null;
  label?: string;
}

export function IntegrationStatusBadge(
  { integration, label }: IntegrationStatusBadgeProps,
) {
  if (!integration) {
    return null;
  }

  const isHealthy = integration.status === "ok";
  const badgeLabel = label ?? integration.target;
  const description = integration.message ??
    (isHealthy ? "Integration healthy" : "Running in degraded mode");

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={isHealthy ? styles.badgeOk : styles.badgeDegraded}>
        {badgeLabel}
      </span>
      <span className={styles.message}>{description}</span>
      {!isHealthy && integration.reason
        ? <span className={styles.code}>({integration.reason})</span>
        : null}
    </div>
  );
}
