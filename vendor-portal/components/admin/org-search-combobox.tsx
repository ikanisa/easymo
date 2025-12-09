"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/providers/i18n-provider";

export type OrgType = "MFI" | "DISTRICT";
export type OrgSearchResult = { id: string; name: string; district_code?: string | null };

interface OrgSearchComboboxProps {
  type: OrgType;
  value?: OrgSearchResult | null;
  onChange: (value: OrgSearchResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function OrgSearchCombobox({
  type,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: OrgSearchComboboxProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrgSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(
    () => `/api/orgs/search?type=${encodeURIComponent(type)}&q=${encodeURIComponent(query)}`,
    [type, query]
  );

  useEffect(() => {
    let active = true;
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint);
        if (!active) return;
        if (!res.ok) {
          setError(t("common.searchFailed", "Search failed"));
          setResults([]);
        } else {
          const { organizations } = (await res.json()) as { organizations: OrgSearchResult[] };
          setResults(organizations ?? []);
        }
      } catch {
        if (!active) return;
        setError(t("common.searchFailed", "Search failed"));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [endpoint, query, t]);

  const selectedLabel = useMemo(() => value?.name ?? placeholder, [value, placeholder]);

  const label =
    type === "MFI"
      ? t("admin.invite.assignMfi", "Assign MFI")
      : t("admin.invite.assignDistrict", "Assign District");
  const ph =
    placeholder ??
    (type === "MFI"
      ? t("admin.invite.searchMfi", "Search MFIs")
      : t("admin.invite.searchDistrict", "Search Districts"));

  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">{label}</label>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ph}
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
                  {result.district_code && (
                    <span className="text-xs text-neutral-2">{result.district_code}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
