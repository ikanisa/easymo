import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

import { cn } from "../utils/cn";

export type FormLayoutVariant = "single" | "double";

export interface FormLayoutProps {
  variant?: FormLayoutVariant;
  className?: string;
  children: ReactNode;
  gap?: string;
}

export function FormLayout({
  variant = "single",
  className,
  children,
  gap = "gap-6",
}: FormLayoutProps) {
  return (
    <div
      className={cn(
        "grid",
        variant === "single" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
        gap,
        className
      )}
    >
      {children}
    </div>
  );
}

export interface FormFieldProps {
  label: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inputId?: string;
  required?: boolean;
  optionalLabel?: ReactNode;
  actions?: ReactNode;
  children: ReactNode | ((props: { id?: string; describedBy?: string }) => ReactNode);
  className?: string;
}

export function FormField({
  label,
  description,
  hint,
  error,
  inputId,
  required,
  optionalLabel,
  actions,
  children,
  className,
}: FormFieldProps) {
  const helperId = inputId ? `${inputId}-description` : undefined;
  const errorId = inputId ? `${inputId}-error` : undefined;

  const describedBy =
    [helperId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  const control =
    typeof children === "function" ? children({ id: inputId, describedBy }) : children;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-neutral-200/80 bg-white/60 p-4 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-neutral-700/70 dark:bg-neutral-900/60",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          htmlFor={typeof inputId === "string" ? inputId : undefined}
          className="text-[13px] font-semibold uppercase tracking-[0.18em] text-neutral-700 dark:text-neutral-200"
        >
          {label}
          {required ? <span className="ml-2 text-[11px] text-rose-400">*</span> : null}
          {!required && optionalLabel ? (
            <span className="ml-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              {optionalLabel}
            </span>
          ) : null}
        </label>
        {actions ? (
          <div className="text-xs uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
            {actions}
          </div>
        ) : null}
      </div>

      {description ? (
        <p id={helperId} className="text-sm leading-snug text-neutral-600 dark:text-neutral-300">
          {description}
        </p>
      ) : null}

      <div aria-describedby={describedBy}>{control}</div>

      {hint ? <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export type FormSummaryStatus = "error" | "warning" | "info" | "success";

const SUMMARY_STYLES: Record<
  FormSummaryStatus,
  { container: string; icon: ReactNode; accent: string }
> = {
  error: {
    container:
      "border border-rose-200/70 bg-gradient-to-br from-rose-50/90 via-white/60 to-white/40 text-rose-900 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-rose-200/30 dark:from-rose-400/20 dark:via-neutral-900/70 dark:to-neutral-900/40 dark:text-rose-100",
    icon: <ShieldAlert className="h-5 w-5" aria-hidden />,
    accent: "text-rose-500 dark:text-rose-100",
  },
  warning: {
    container:
      "border border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-white/60 to-white/40 text-amber-900 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-amber-200/30 dark:from-amber-300/15 dark:via-neutral-900/70 dark:to-neutral-900/40 dark:text-amber-50",
    icon: <AlertCircle className="h-5 w-5" aria-hidden />,
    accent: "text-amber-600 dark:text-amber-100",
  },
  info: {
    container:
      "border border-sky-200/70 bg-gradient-to-br from-sky-50/90 via-white/60 to-white/40 text-sky-900 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-sky-200/30 dark:from-sky-300/15 dark:via-neutral-900/70 dark:to-neutral-900/40 dark:text-sky-50",
    icon: <Info className="h-5 w-5" aria-hidden />,
    accent: "text-sky-700 dark:text-sky-100",
  },
  success: {
    container:
      "border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white/60 to-white/40 text-emerald-900 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-emerald-200/30 dark:from-emerald-300/15 dark:via-neutral-900/70 dark:to-neutral-900/40 dark:text-emerald-50",
    icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
    accent: "text-emerald-700 dark:text-emerald-100",
  },
};

export interface FormSummaryBannerProps {
  title: ReactNode;
  description?: ReactNode;
  status?: FormSummaryStatus;
  actions?: ReactNode;
  items?: ReactNode[];
  className?: string;
}

export function FormSummaryBanner({
  title,
  description,
  status = "info",
  actions,
  items,
  className,
}: FormSummaryBannerProps) {
  const tone = SUMMARY_STYLES[status];

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-[calc(var(--radius-xl)_*_1.1)] border p-4 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.05)]",
        tone.container,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10">
          {tone.icon}
        </span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{title}</p>
          {description ? <p className="text-xs text-white/80">{description}</p> : null}
        </div>
        {actions ? <div className="text-xs uppercase tracking-[0.3em]">{actions}</div> : null}
      </div>
      {items && items.length > 0 ? (
        <ul className={cn("list-disc space-y-1 pl-6 text-xs", tone.accent)}>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
