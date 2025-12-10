"use client";

import { forwardRef, type ReactNode } from "react";
import { Card, CardHeader, CardContent, CardFooter, type CardProps } from "./card";
import { cn } from "../utils/cn";

/**
 * StatCard - For displaying metrics and KPIs
 * Consolidates: stat-card, metric-card, kpi-card
 */
export interface StatCardProps extends CardProps {
  label: string;
  value: ReactNode;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral";
  };
  icon?: ReactNode;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(function StatCard(
  { label, value, change, icon, className, ...props },
  ref
) {
  return (
    <Card ref={ref} variant="default" padding="md" className={className} {...props}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                change.trend === "up" && "text-green-600 dark:text-green-400",
                change.trend === "down" && "text-red-600 dark:text-red-400",
                change.trend === "neutral" && "text-neutral-600 dark:text-neutral-400"
              )}
            >
              {change.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
});

/**
 * ActionCard - For clickable cards with actions
 * Consolidates: feature-card, service-card, quick-action-card
 */
export interface ActionCardProps extends CardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
}

export const ActionCard = forwardRef<HTMLDivElement, ActionCardProps>(function ActionCard(
  { title, description, icon, badge, action, onAction, className, ...props },
  ref
) {
  return (
    <Card
      ref={ref}
      variant="default"
      padding="lg"
      hover
      interactive={!!onAction}
      onClick={onAction}
      className={className}
      {...props}
    >
      <CardHeader
        title={
          <div className="flex items-center gap-3">
            {icon && <div className="flex-shrink-0">{icon}</div>}
            <span>{title}</span>
            {badge && <div className="ml-auto">{badge}</div>}
          </div>
        }
        description={description}
      />
      {action && <CardFooter>{action}</CardFooter>}
    </Card>
  );
});

/**
 * ListCard - For list items with metadata
 * Consolidates: member-card, group-card, transaction-card
 */
export interface ListCardProps extends CardProps {
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  status?: ReactNode;
  metadata?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}

export const ListCard = forwardRef<HTMLDivElement, ListCardProps>(function ListCard(
  { title, subtitle, avatar, status, metadata, actions, className, ...props },
  ref
) {
  return (
    <Card ref={ref} variant="default" padding="md" className={className} {...props}>
      <div className="flex items-start gap-4">
        {avatar && <div className="flex-shrink-0">{avatar}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            {status && <div className="flex-shrink-0">{status}</div>}
          </div>
          {metadata && metadata.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {metadata.map((item, idx) => (
                <div key={idx}>
                  <span className="text-neutral-600 dark:text-neutral-400">{item.label}: </span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </Card>
  );
});

/**
 * InfoCard - For informational content with icon
 * Consolidates: alert-card, banner-card, notice-card
 */
export interface InfoCardProps extends Omit<CardProps, "variant"> {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  message: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const INFO_VARIANTS = {
  info: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
  success: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
  warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
  error: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
};

const INFO_ICON_COLORS = {
  info: "text-blue-600 dark:text-blue-400",
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
};

export const InfoCard = forwardRef<HTMLDivElement, InfoCardProps>(function InfoCard(
  { variant = "info", title, message, icon, action, dismissible, onDismiss, className, ...props },
  ref
) {
  return (
    <Card ref={ref} padding="md" className={cn(INFO_VARIANTS[variant], className)} {...props}>
      <div className="flex gap-3">
        {icon && <div className={cn("flex-shrink-0", INFO_ICON_COLORS[variant])}>{icon}</div>}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{title}</h4>
          )}
          <div className="text-sm text-neutral-700 dark:text-neutral-300">{message}</div>
          {action && <div className="mt-3">{action}</div>}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            aria-label="Dismiss"
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
    </Card>
  );
});

/**
 * FormCard - For forms and settings sections
 * Consolidates: settings-card, form-section-card
 */
export interface FormCardProps extends CardProps {
  title: string;
  description?: string;
  footer?: ReactNode;
}

export const FormCard = forwardRef<HTMLDivElement, FormCardProps>(function FormCard(
  { title, description, footer, children, className, ...props },
  ref
) {
  return (
    <Card ref={ref} variant="default" padding="lg" className={className} {...props}>
      <CardHeader title={title} description={description} />
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
});
