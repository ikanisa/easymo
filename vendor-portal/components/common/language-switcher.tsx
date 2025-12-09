"use client";

import type { ChangeEvent } from "react";
import { useCallback } from "react";
import { useTranslation } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "rw", label: "Kinyarwanda" },
] as const;

interface LanguageSwitcherProps {
  className?: string;
  variant?: "default" | "compact";
}

export function LanguageSwitcher({ className, variant = "default" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setLocale(event.target.value as (typeof OPTIONS)[number]["value"]);
    },
    [setLocale]
  );

  const labelText = t("common.language", "Language");

  return (
    <label
      className={cn(
        "flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-neutral-600 dark:text-neutral-400",
        variant === "compact" && "gap-1 text-[10px]",
        className
      )}
    >
      {variant === "default" ? <span>{labelText}</span> : null}
      <select
        value={locale}
        onChange={handleChange}
        aria-label={labelText}
        title={labelText}
        className={cn(
          "rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-900 transition hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-atlas-blue dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600",
          variant === "compact" && "px-2"
        )}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="text-neutral-900">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
