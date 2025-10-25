import styles from "./IntegrationStatusBadge.module.css";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";

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
      <Tooltip label={isHealthy ? 'Integration healthy' : 'Running in degraded mode'}>
        <Badge variant={isHealthy ? 'green' : 'yellow'}>{badgeLabel}</Badge>
      </Tooltip>
      <span className={styles.message}>{description}</span>
      {!isHealthy && integration.reason
        ? <span className={styles.code}>({integration.reason})</span>
        : null}
    </div>
  );
}
