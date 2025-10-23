"use client";
import { useState } from "react";

export default function SuggestionsEmbedPage() {
  const [limit, setLimit] = useState(10);
  const [region, setRegion] = useState("");
  const [reembed, setReembed] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setError(null);
    setResult("");
    setLoading(true);
    try {
      // Call Edge Function directly through Next's Supabase client is non-trivial here; call the function endpoint directly via API base
      const apiBase = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      if (!apiBase) throw new Error('Supabase URL not configured');
      const url = `${apiBase.replace(/\/$/, '')}/functions/v1/svc-business-embed`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}` },
        body: JSON.stringify({ limit, region: region || undefined, reembed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'embed failed');
      setResult(JSON.stringify(json));
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Embed Businesses (Vector)</h1>
      <div className="grid gap-2 max-w-xl">
        <label className="grid gap-1">
          <span className="text-sm">Limit</span>
          <input type="number" className="border p-2 rounded" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Region (optional)</span>
          <input className="border p-2 rounded" value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={reembed} onChange={(e) => setReembed(e.target.checked)} />
          <span className="text-sm">Re-embed existing</span>
        </label>
        <button disabled={loading} onClick={run} className="bg-black text-white px-4 py-2 rounded w-fit">{loading ? 'Embedding…' : 'Run Embedding'}</button>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {result && <pre className="text-xs bg-gray-100 p-2 border overflow-x-auto">{result}</pre>}
      </div>
    </div>
  );
}

