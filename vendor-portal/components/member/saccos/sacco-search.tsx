"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Landmark } from "lucide-react";

interface SaccoSearchResult {
  id: string;
  name: string;
  district: string;
  sector_code: string;
}

export function SaccoSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SaccoSearchResult[]>([]);
  const [isSearching, startSearching] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();
  const router = useRouter();

  const search = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    startSearching(async () => {
      const response = await fetch(`/api/member/saccos/search?q=${encodeURIComponent(value)}`);
      if (!response.ok) {
        console.error("Failed to search SACCOs");
        return;
      }
      const data = (await response.json()) as { results: SaccoSearchResult[] };
      setResults(data.results);
    });
  };

  const addSacco = (saccoId: string) => {
    startSubmit(async () => {
      const response = await fetch("/api/member/saccos/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saccoId }),
      });
      if (!response.ok) {
        console.error("Failed to add SACCO");
        return;
      }
      setQuery("");
      setResults([]);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 rounded-3xl border border-white/20 bg-white/5 px-4 py-3 text-neutral-0">
        <Search className="h-5 w-5" aria-hidden />
        <span className="sr-only">Search SACCOs</span>
        <input
          className="w-full bg-transparent text-base focus:outline-none"
          placeholder="Search for your SACCO"
          value={query}
          onChange={(event) => search(event.target.value)}
        />
        {isSearching ? <span className="text-sm text-white/70">Searching…</span> : null}
      </label>

      {results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((result) => (
            <li
              key={result.id}
              className="flex items-center justify-between rounded-3xl border border-white/15 bg-white/6 px-4 py-3"
            >
              <div className="flex items-center gap-3 text-neutral-0">
                <Landmark className="h-5 w-5" aria-hidden />
                <div>
                  <p className="text-base font-semibold">{result.name}</p>
                  <p className="text-xs text-white/70">
                    {result.district} · {result.sector_code}
                  </p>
                </div>
              </div>
              <button
                className="rounded-2xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-emerald-500 disabled:opacity-60"
                onClick={() => addSacco(result.id)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding…" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      ) : query.length >= 2 && !isSearching ? (
        <p className="text-sm text-white/70">No matches found.</p>
      ) : null}
    </div>
  );
}
