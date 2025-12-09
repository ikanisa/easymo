"use client";

import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  title: string;
  count: number;
  href: Route;
  priority: "high" | "medium" | "low";
  icon?: "alert" | "clock" | "trend";
}

const priorityConfig = {
  high: {
    bg: "bg-danger-50 dark:bg-danger-950/20",
    border: "border-danger-200 dark:border-danger-800",
    text: "text-danger-700 dark:text-danger-300",
    badge: "bg-danger-500",
  },
  medium: {
    bg: "bg-warning-50 dark:bg-warning-950/20",
    border: "border-warning-200 dark:border-warning-800",
    text: "text-warning-700 dark:text-warning-300",
    badge: "bg-warning-500",
  },
  low: {
    bg: "bg-primary-50 dark:bg-primary-950/20",
    border: "border-primary-200 dark:border-primary-800",
    text: "text-primary-700 dark:text-primary-300",
    badge: "bg-primary-500",
  },
};

const iconMap = {
  alert: AlertCircle,
  clock: Clock,
  trend: TrendingUp,
};

export function TaskCard({ title, count, href, priority, icon = "alert" }: TaskCardProps) {
  const config = priorityConfig[priority];
  const Icon = iconMap[icon];

  return (
    <Link href={href} className="block">
      <div
        className={cn(
          "flex items-center justify-between rounded-lg border p-4",
          "transition-all duration-200",
          "hover:shadow-md hover:-translate-y-0.5",
          config.bg,
          config.border
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("rounded-full p-2", config.badge, "bg-opacity-10")}>
            <Icon className={cn("h-5 w-5", config.text)} />
          </div>
          <div>
            <h4 className={cn("text-sm font-semibold", config.text)}>{title}</h4>
            <p className="text-xs text-foreground-muted">{count} items</p>
          </div>
        </div>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
            config.badge,
            "text-white"
          )}
        >
          {count}
        </div>
      </div>
    </Link>
  );
}
