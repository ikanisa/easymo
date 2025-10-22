"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getAdminRoutePath } from "@/lib/routes";

interface SearchResult {
  chunk_id: string;
  document_id: string;
  agent_id: string;
  document_title: string | null;
  chunk_index: number;
  content: string;
  similarity: number;
}

export default function AgentDocumentSearch({ params }: { params: { id: string } }) {
  const agentId = params.id;
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const [minSimilarity, setMinSimilarity] = useState(0.15);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [usage, setUsage] = useState<{ prompt_tokens?: number; total_tokens?: number } | null>(null);

  const hasResults = results.length > 0;
  const similarityPercentiles = useMemo(() => {
    if (!results.length) return null;
    const sorted = [...results].sort((a, b) => b.similarity - a.similarity);
    const best = sorted[0]?.similarity ?? 0;
    const median = sorted[Math.floor(sorted.length / 2)]?.similarity ?? 0;
    return { best, median };
  }, [results]);

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setError("Enter a question or phrase to search.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit, minSimilarity }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "unknown" }));
        setError(payload?.message || payload?.error || "Search failed. Please try again.");
        setResults([]);
        setUsage(null);
        return;
      }
      const payload = await response.json();
      setResults(Array.isArray(payload.matches) ? payload.matches : []);
      setUsage(payload.usage ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults([]);
      setUsage(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Semantic search</h1>
          <p className="text-sm text-gray-500">
            Query embedded knowledge across all documents linked to this agent.
          </p>
        </div>
        <Link
          href={getAdminRoutePath("adminAgentDetail", { agentId })}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to agent overview
        </Link>
      </div>

      <form onSubmit={runSearch} className="grid gap-4 rounded-lg border p-4 bg-white">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Search prompt</span>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask a question or describe the content you need"
            className="border rounded px-3 py-2 min-h-[80px]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">Max results</span>
            <input
              type="number"
              min={1}
              max={20}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">Min similarity</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={minSimilarity}
              onChange={(event) => setMinSimilarity(Number(event.target.value))}
              className="border rounded px-3 py-2"
            />
          </label>
          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
            <div className="border rounded px-3 py-2 text-sm text-gray-600">
              {isLoading ? "Searching…" : hasResults ? `${results.length} matches` : "Idle"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Searching…" : "Run search"}
          </button>
          {usage?.total_tokens ? (
            <span className="text-xs text-gray-500">
              Tokens used: {usage.total_tokens}{" "}
              {usage.prompt_tokens ? `(prompt ${usage.prompt_tokens})` : null}
            </span>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Matches</h2>
          {similarityPercentiles ? (
            <div className="text-xs text-gray-500">
              Best: {(similarityPercentiles.best * 100).toFixed(1)}% • Median: {(similarityPercentiles.median * 100).toFixed(1)}%
            </div>
          ) : null}
        </div>

        {hasResults ? (
          <ol className="grid gap-3">
            {results.map((match) => (
              <li key={match.chunk_id} className="rounded border p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {match.document_title || "Untitled document"}
                    </div>
                    <div className="text-xs text-gray-500">
                      Chunk #{match.chunk_index + 1} • Similarity {(match.similarity * 100).toFixed(1)}%
                    </div>
                  </div>
                  <Link
                    href={`/api/agents/${agentId}/documents/${match.document_id}/signed`}
                    className="text-xs text-blue-600 underline"
                    prefetch={false}
                  >
                    Download original
                  </Link>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {match.content}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded border border-dashed p-8 text-center text-sm text-gray-500">
            {isLoading ? "Looking for relevant content…" : "No matches yet. Try a broader prompt."}
          </div>
        )}
      </section>
    </div>
  );
}
