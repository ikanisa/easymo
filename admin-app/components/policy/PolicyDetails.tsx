"use client";

import { useMemo } from "react";
import { useSettingsPreviewQuery } from "@/lib/queries/settings";
import styles from "./PolicyDetails.module.css";

const QUIET_HOURS_KEY = "quiet_hours.rw";
const THROTTLE_KEY = "send_throttle.whatsapp.per_minute";
const OPT_OUT_KEY = "opt_out.list";

function parseOptOutCount(value?: string | null): number | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

export function PolicyDetails() {
  const settingsQuery = useSettingsPreviewQuery({ limit: 50 });

  const summary = useMemo(() => {
    const entries = settingsQuery.data?.data ?? [];
    const quiet = entries.find((entry) => entry.key === QUIET_HOURS_KEY);
    const throttle = entries.find((entry) => entry.key === THROTTLE_KEY);
    const optOut = entries.find((entry) => entry.key === OPT_OUT_KEY);

    return {
      quiet: quiet?.valuePreview ?? "Not configured",
      throttle: throttle?.valuePreview ?? "Not configured",
      optOutCount: parseOptOutCount(optOut?.valuePreview),
      quietUpdatedAt: quiet?.updatedAt,
      throttleUpdatedAt: throttle?.updatedAt,
      optOutUpdatedAt: optOut?.updatedAt,
    };
  }, [settingsQuery.data?.data]);

  return (
    <details className={styles.details} data-state={settingsQuery.isLoading ? "loading" : "ready"}>
      <summary className={styles.summary}>Policy details</summary>
      {settingsQuery.isLoading
        ? <p className={styles.loading}>Loading policy metadata…</p>
        : (
          <div className={styles.body}>
            <dl className={styles.list}>
              <div>
                <dt>Quiet hours</dt>
                <dd>
                  {summary.quiet}
                  {summary.quietUpdatedAt
                    ? (
                      <span className={styles.meta}>
                        Updated {new Date(summary.quietUpdatedAt).toLocaleString()}
                      </span>
                    )
                    : null}
                </dd>
              </div>
              <div>
                <dt>WhatsApp throttle</dt>
                <dd>
                  {summary.throttle}
                  {summary.throttleUpdatedAt
                    ? (
                      <span className={styles.meta}>
                        Updated {new Date(summary.throttleUpdatedAt).toLocaleString()}
                      </span>
                    )
                    : null}
                </dd>
              </div>
              <div>
                <dt>Opt-out list</dt>
                <dd>
                  {summary.optOutCount != null
                    ? `${summary.optOutCount} contact${summary.optOutCount === 1 ? "" : "s"}`
                    : "Not available"}
                  {summary.optOutUpdatedAt
                    ? (
                      <span className={styles.meta}>
                        Updated {new Date(summary.optOutUpdatedAt).toLocaleString()}
                      </span>
                    )
                    : null}
                </dd>
              </div>
            </dl>
            <p className={styles.help}>
              Review these settings under <strong>Settings → Policies</strong> before
              overriding blocks.
            </p>
          </div>
        )}
    </details>
  );
}
