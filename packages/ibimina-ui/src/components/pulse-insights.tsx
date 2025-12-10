"use client";

import { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface PulseInsight {
  id: string;
  type: "action" | "info" | "milestone" | "alert";
  icon?: ReactNode;
  title: string;
  description: string;
  timestamp?: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

export interface PulseInsightsProps {
  insights: PulseInsight[];
  onDismiss?: (id: string) => void;
  emptyMessage?: string;
  className?: string;
}

const TYPE_STYLES = {
  action: {
    bg: "bg-atlas-blue/10 dark:bg-atlas-blue/20",
    border: "border-atlas-blue/20 dark:border-atlas-blue/30",
    icon: "text-atlas-blue-dark dark:text-atlas-blue",
  },
  info: {
    bg: "bg-neutral-50 dark:bg-neutral-800/50",
    border: "border-neutral-200 dark:border-neutral-700",
    icon: "text-neutral-600 dark:text-neutral-400",
  },
  milestone: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    icon: "text-green-600 dark:text-green-400",
  },
  alert: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-200 dark:border-yellow-800",
    icon: "text-yellow-600 dark:text-yellow-400",
  },
};

export function PulseInsights({
  insights,
  onDismiss,
  emptyMessage,
  className,
}: PulseInsightsProps) {
  if (insights.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-12 text-center dark:border-neutral-700 dark:bg-neutral-800/50",
          className
        )}
      >
        <p className="text-neutral-600 dark:text-neutral-400">
          {emptyMessage || "No new insights right now. Check back later!"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {insights.map((insight) => (
        <PulseInsightCard key={insight.id} insight={insight} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface PulseInsightCardProps {
  insight: PulseInsight;
  onDismiss?: (id: string) => void;
}

function PulseInsightCard({ insight, onDismiss }: PulseInsightCardProps) {
  const styles = TYPE_STYLES[insight.type];

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4 transition-all duration-200 hover:shadow-md",
        styles.bg,
        styles.border
      )}
    >
      <div className="flex gap-4">
        {insight.icon && <div className={cn("flex-shrink-0", styles.icon)}>{insight.icon}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {insight.title}
            </h3>
            {insight.timestamp && (
              <time className="flex-shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                {formatRelativeTime(insight.timestamp)}
              </time>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {insight.description}
          </p>
          {insight.action && (
            <button
              onClick={insight.action.onClick}
              className={cn(
                "mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "bg-white text-neutral-900 hover:bg-neutral-100",
                "dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
                "border border-neutral-200 dark:border-neutral-600"
              )}
            >
              {insight.action.label}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>
        {insight.dismissible && onDismiss && (
          <button
            onClick={() => onDismiss(insight.id)}
            className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            aria-label="Dismiss insight"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
