"use client";

import { useEffect, useState } from "react";
import styles from "./AlertPreferences.module.css";
import { useAdminAlertPreferencesQuery } from "@/lib/queries/alertPreferences";
import type { AdminAlertPreference } from "@/lib/schemas";
import type { AlertPreferencesIntegration } from "@/lib/settings/alert-preferences-service";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/ToastProvider";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";

function formatUpdatedAt(timestamp?: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function severityTone(severity: AdminAlertPreference["severity"]) {
  switch (severity) {
    case "critical":
      return { tone: "danger" as const, label: "Critical" };
    case "high":
      return { tone: "warning" as const, label: "High" };
    case "medium":
      return { tone: "info" as const, label: "Medium" };
    case "low":
    default:
      return { tone: "info" as const, label: "Low" };
  }
}

export function AlertPreferences() {
  const { data, isLoading } = useAdminAlertPreferencesQuery();
  const [preferences, setPreferences] = useState<AdminAlertPreference[]>([]);
  const [integration, setIntegration] =
    useState<AlertPreferencesIntegration | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    if (data?.data) {
      setPreferences(data.data);
      setIntegration(data.integration ?? null);
    }
  }, [data]);

  const hasPreferences = preferences.length > 0;

  const clonePreferences = (source: AdminAlertPreference[]) =>
    source.map((item) => ({
      ...item,
      channels: [...item.channels],
      availableChannels: item.availableChannels?.slice(),
    }));

  const savePreference = async (
    pref: AdminAlertPreference,
    overrides: Partial<Pick<AdminAlertPreference, "enabled" | "channels">>,
  ) => {
    const nextEnabled = overrides.enabled ?? pref.enabled;
    const nextChannels = overrides.channels ?? pref.channels;

    if (nextEnabled && nextChannels.length === 0) {
      const message = "Select at least one channel or disable the alert.";
      setError(message);
      pushToast(message, "error");
      return;
    }

    const snapshot = clonePreferences(preferences);
    const snapshotIntegration = integration;
    setSavingKey(pref.key);
    setError(null);

    setPreferences((current) =>
      current.map((item) =>
        item.key === pref.key
          ? { ...item, enabled: nextEnabled, channels: nextChannels }
          : item
      )
    );

    try {
      const response = await fetch("/api/settings/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ key: pref.key, enabled: nextEnabled, channels: nextChannels }],
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof result?.message === "string"
            ? result.message
            : "Failed to save alert preference.";
        throw new Error(message);
      }
      if (Array.isArray(result?.data)) {
        setPreferences(result.data as AdminAlertPreference[]);
        setIntegration(result?.integration ?? null);
      }
      if (typeof result?.message === "string") {
        pushToast(result.message, "success");
      } else {
        pushToast("Alert preference saved.", "success");
      }
    } catch (cause) {
      setPreferences(snapshot);
      setIntegration(snapshotIntegration ?? null);
      const message = cause instanceof Error
        ? cause.message
        : "Unable to save alert preference.";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = (pref: AdminAlertPreference) => {
    savePreference(pref, { enabled: !pref.enabled });
  };

  const handleChannelToggle = (
    pref: AdminAlertPreference,
    channel: string,
  ) => {
    const hasChannel = pref.channels.includes(channel);
    const nextChannels = hasChannel
      ? pref.channels.filter((value) => value !== channel)
      : [...pref.channels, channel].sort();
    savePreference(pref, { channels: nextChannels });
  };

  if (isLoading && !hasPreferences) {
    return (
      <LoadingState
        title="Loading alert preferences"
        description="Fetching admin alert preferences."
      />
    );
  }

  if (!hasPreferences && !isLoading) {
    return (
      <EmptyState
        title="No alert preferences defined"
        description="Alert subscriptions will appear once they are configured."
      />
    );
  }

  return (
    <div className={styles.container}>
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="Alerts store"
          />
        )
        : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <ul className={styles.list}>
        {preferences.map((preference) => {
          const severity = severityTone(preference.severity);
          const updatedLabel = formatUpdatedAt(preference.updatedAt);
          return (
            <li key={preference.key} className={styles.item}>
              <div className={styles.header}>
                <div>
                  <p className={styles.key}>{preference.key}</p>
                  <h3 className={styles.title}>{preference.label}</h3>
                </div>
                <Pill tone={severity.tone}>{severity.label}</Pill>
              </div>
              <p className={styles.description}>{preference.description}</p>
              <div className={styles.meta}>
                <div className={styles.channelsSection}>
                  <span className={styles.metaLabel}>Channels</span>
                  <div className={styles.channelList}>
                    {(preference.availableChannels ?? preference.channels).map(
                      (channel) => {
                        const isChecked = preference.channels.includes(channel);
                        return (
                          <label
                            key={channel}
                            className={styles.channelOption}
                            aria-disabled={savingKey === preference.key ? "true" : "false"}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={savingKey === preference.key}
                              onChange={() => handleChannelToggle(preference, channel)}
                            />
                            <span>{channel}</span>
                          </label>
                        );
                      },
                    )}
                  </div>
                </div>
                {updatedLabel
                  ? (
                    <div className={styles.updatedAt}>
                      <span className={styles.metaLabel}>Updated</span>
                      <span>{updatedLabel}</span>
                    </div>
                  )
                  : null}
              </div>
              <label
                className={styles.toggle}
                aria-disabled={savingKey === preference.key ? "true" : "false"}
              >
                <input
                  type="checkbox"
                  checked={preference.enabled}
                  disabled={savingKey === preference.key}
                  aria-label={`Toggle ${preference.label}`}
                  onChange={() => handleToggle(preference)}
                />
                <span>
                  {preference.enabled ? "Enabled" : "Disabled"}
                  {savingKey === preference.key ? "…" : ""}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
