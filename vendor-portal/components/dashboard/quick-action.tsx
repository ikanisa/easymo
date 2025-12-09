"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Plus, Upload, FileText, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/src/lib/analytics";

interface QuickActionProps {
  href: Route;
  label: ReactNode;
  description?: ReactNode;
  eventName?: string;
  eventProperties?: Record<string, unknown>;
}

function getActionLabel(label: ReactNode): string {
  const labelStr = String(label);
  if (labelStr.includes("Create")) return "Create group";
  if (labelStr.includes("Import Members")) return "Upload CSV";
  if (labelStr.includes("Import Statement")) return "Upload statement";
  if (labelStr.includes("Reconciliation")) return "Open reconciliation";
  return "View";
}

function getActionIcon(label: ReactNode) {
  const labelStr = String(label);
  if (labelStr.includes("Create")) return Plus;
  if (labelStr.includes("Import Members")) return Upload;
  if (labelStr.includes("Import Statement")) return FileText;
  if (labelStr.includes("Reconciliation")) return Search;
  return null;
}

export function QuickAction({
  href,
  label,
  description,
  eventName,
  eventProperties,
}: QuickActionProps) {
  const handleClick = () => {
    if (eventName) {
      void track(eventName, eventProperties);
    }
  };

  const Icon = getActionIcon(label);

  return (
    <Link href={href} className="block" onClick={handleClick}>
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "group flex h-full min-h-[160px] flex-col justify-between",
          "rounded-lg border border-border bg-surface-elevated",
          "p-5 text-left shadow-sm",
          "transition-all duration-200",
          "hover:border-primary-400 hover:shadow-lg dark:hover:border-primary-500"
        )}
      >
        {/* Icon */}
        {Icon && (
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10 transition-colors group-hover:bg-primary-500/20">
            <Icon className="h-5 w-5 text-primary-500 dark:text-primary-400" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{label}</h3>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{description}</p>
          )}
        </div>

        {/* CTA */}
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-500 transition group-hover:gap-2 group-hover:text-primary-600 dark:text-primary-400 dark:group-hover:text-primary-300">
          {getActionLabel(label)}
          <ArrowRight className="h-4 w-4" />
        </span>
      </motion.div>
    </Link>
  );
}
