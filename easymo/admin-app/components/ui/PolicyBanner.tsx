"use client";

import styles from "./PolicyBanner.module.css";

type KnownPolicyReason = "opt_out" | "quiet_hours" | "throttled";

const REASON_COPY: Record<
  KnownPolicyReason,
  { title: string; fallback: string; icon: string }
> = {
  opt_out: {
    title: "Opt-out honoured",
    fallback:
      "This contact opted out of communications. Remove them from the target list or confirm consent before retrying.",
    icon: "🚫",
  },
  quiet_hours: {
    title: "Quiet hours in effect",
    fallback:
      "You're within the quiet hours window. Schedule the send after quiet hours or request an approved override.",
    icon: "🌙",
  },
  throttled: {
    title: "Rate limit reached",
    fallback:
      "The per-minute throttle fired. Pause for a minute before trying again or adjust throttle settings.",
    icon: "⏱️",
  },
};

export interface PolicyBannerProps {
  reason: string;
  message?: string | null;
}

export function PolicyBanner({ reason, message }: PolicyBannerProps) {
  const normalized = (reason ?? "").toLowerCase();
  const copy = (REASON_COPY as Record<string, typeof REASON_COPY.opt_out>)[
    normalized
  ];

  const title = copy?.title ?? "Policy block";
  const body = message ?? copy?.fallback ??
    "Outbound policy checks blocked this action. Review policy settings before retrying.";
  const icon = copy?.icon ?? "⚠️";

  return (
    <div
      className={styles.banner}
      role="alert"
      aria-live="assertive"
      data-reason={normalized || "unknown"}
    >
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        <p className={styles.message}>{body}</p>
      </div>
    </div>
  );
}
