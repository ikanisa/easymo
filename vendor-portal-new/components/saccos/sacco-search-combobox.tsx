"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/providers/i18n-provider";

export type SaccoSearchResult = {
  id: string;
  name: string;
  district: string;
  province: string;
  category: string;
};

interface SaccoSearchComboboxProps {
  value?: SaccoSearchResult | null;
  onChange: (value: SaccoSearchResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

let cachedSupabaseClient: ReturnType<typeof getSupabaseBrowserClient> | null = null;
let supabaseClientInitError: Error | null = null;

function resolveSupabaseClient() {
  if (cachedSupabaseClient || supabaseClientInitError) {
    return cachedSupabaseClient;
  }

  try {
    cachedSupabaseClient = getSupabaseBrowserClient();
  } catch (error) {
    const resolvedError = error instanceof Error ? error : new Error(String(error));
    supabaseClientInitError = resolvedError;
    console.error("sacco-search.supabase.init_failed", { message: resolvedError.message });
    cachedSupabaseClient = null;
  }

  return cachedSupabaseClient;
}

export function SaccoSearchCombobox({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: SaccoSearchComboboxProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SaccoSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => resolveSupabaseClient(), []);

  useEffect(() => {
    let active = true;
    const scheduleStateUpdate = (updater: () => void) => {
      queueMicrotask(() => {
        if (active) {
          updater();
        }
      });
    };
    if (!supabase) {
      scheduleStateUpdate(() => {
        if (query.trim()) {
          setError(t("sacco.search.disabled", "Search is unavailable right now."));
        } else {
          setError(null);
        }
        setLoading(false);
        setResults([]);
      });
      return () => {
        active = false;
      };
    }

    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);

      const { data, error } = await (supabase as any).rpc("search_saccos", {
        query: query.trim(),
        limit_count: 12,
      });
      if (!active) return;
      if (error) {
        console.error(error);
        setError(error.message ?? t("common.searchFailed", "Search failed"));
        setResults([]);
      } else {
        const rows =
          (data as Database["public"]["Functions"]["search_saccos"]["Returns"] | null) ?? [];
        setResults(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            district: row.district,
            province: row.province,
            category: row.category,
          }))
        );
      }
      setLoading(false);
    }, 250);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, supabase, t]);

  const selectedLabel = useMemo(() => {
    if (!value) return placeholder;
    return `${value.name} — ${value.district}`;
  }, [value, placeholder]);

  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">
          {t("sacco.search.assignLabel", "Assign SACCO")}
        </label>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder ?? t("sacco.search.placeholder", "Search Umurenge SACCOs")}
          disabled={disabled}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue disabled:opacity-50"
        />
        {value && (
          <div className="mt-3 text-xs text-neutral-1">
            <span className="font-semibold text-neutral-0">{selectedLabel}</span>
            <button
              type="button"
              className="ml-2 text-rw-yellow underline-offset-2 hover:underline"
              onClick={() => onChange(null)}
            >
              {t("common.clear", "Clear")}
            </button>
          </div>
        )}
        <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/10">
          {loading && (
            <p className="px-3 py-2 text-xs text-neutral-2">
              {t("common.searching", "Searching…")}
            </p>
          )}
          {error && <p className="px-3 py-2 text-xs text-red-300">{error}</p>}
          {!loading && !error && results.length === 0 && query && (
            <p className="px-3 py-2 text-xs text-neutral-2">
              {t("sacco.search.none", "No matches")}
            </p>
          )}
          <ul>
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 px-3 py-2 text-left text-sm text-neutral-0 hover:bg-white/10"
                  onClick={() => {
                    onChange(result);
                    setQuery("");
                  }}
                >
                  <span className="font-medium">{result.name}</span>
                  <span className="text-xs text-neutral-2">
                    {result.district} · {result.province}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
