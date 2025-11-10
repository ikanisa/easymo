"use client";

import {
  IntegrationTarget,
  useIntegrationStatusQuery,
} from "@/lib/queries/integrations";
import styles from "./IntegrationsStatus.module.css";

const PANEL_TARGETS: IntegrationTarget[] = [
  "whatsappSend",
  "storageSignedUrl",
];

const LABELS: Record<IntegrationTarget, string> = {
  whatsappSend: "WhatsApp send",
  storageSignedUrl: "Storage signed URLs",
};

export function IntegrationsStatus() {
  const { data, isLoading, isError } = useIntegrationStatusQuery();

  if (isLoading) {
    return <p>Checking integrations…</p>;
  }

  if (isError || !data) {
    return <p>Unable to load integrations status.</p>;
  }

  return (
    <div className={styles.grid} role="status" aria-live="polite">
      {PANEL_TARGETS.map((target) => {
        const entry = data[target];
        const cardClass = `${styles.card} ${styles[`card_${entry.status}`]}`;
        return (
          <div key={target} className={cardClass} title={entry.message}>
            <span className={styles.label}>{LABELS[target]}</span>
            <span className={styles.message}>{entry.message}</span>
          </div>
        );
      })}
    </div>
  );
}
