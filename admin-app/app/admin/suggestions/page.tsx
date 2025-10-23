"use client";
import { useState } from "react";

export default function SuggestionsPage() {
  const [text, setText] = useState("pharmacy near kigali");
  const [region, setRegion] = useState("kigali");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    setItems([]);
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_API_BASE || process.env.BACKEND_API_BASE || "";
      const url = `${apiBase.replace(/\/$/, '')}/realtime/suggestions/search`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, region, limit: 5 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "search failed");
      setItems(json?.items ?? []);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Business Suggestions</h1>
      <div className="grid gap-2 max-w-2xl">
        <label className="grid gap-1">
          <span className="text-sm">Query text</span>
          <input className="border p-2 rounded" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Region</span>
          <input className="border p-2 rounded" value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>
        <button disabled={loading} onClick={search} className="bg-black text-white px-4 py-2 rounded w-fit">{loading ? "Searching…" : "Search"}</button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid gap-2">
        {items.map((b: any) => (
          <div key={b.id} className="border p-3 rounded">
            <div className="font-semibold">{b.name ?? b.id}</div>
            <div className="text-sm text-gray-600">{b.category ?? '-'} | {b.region ?? '-'}</div>
            {b.tags && <div className="text-xs">tags: {Array.isArray(b.tags) ? b.tags.join(', ') : JSON.stringify(b.tags)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

