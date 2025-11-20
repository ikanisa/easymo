"use client";

import { useConnectivity } from "@/components/providers/ConnectivityProvider";
import styles from "./OfflineBanner.module.css";

export function OfflineBanner() {
  const { isOffline } = useConnectivity();
  if (!isOffline) return null;

  return (
    <div className={styles.overlay} role="status" aria-live="assertive">
      <div className={styles.wrapper}>
        <div className={styles.indicator} aria-hidden="true" />
        <div className={styles.copy}>
          <strong>You appear to be offline</strong>
          <span>
            Connection lost. Lists stay readable, but writes resume once you are
            back online.
          </span>
        </div>
      </div>
    </div>
  );
}
