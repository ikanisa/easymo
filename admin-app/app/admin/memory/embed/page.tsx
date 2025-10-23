"use client";
import { useState } from "react";

export default function MemoryEmbedPage() {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setError(null);
    setResult("");
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      if (!apiBase) throw new Error('Supabase URL not configured');
      const url = `${apiBase.replace(/\/$/, '')}/functions/v1/svc-user-embed`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}` },
        body: JSON.stringify({ user_id: userId }),
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
      <h1 className="text-2xl font-semibold">Embed User Profile (Vector)</h1>
      <div className="grid gap-2 max-w-xl">
        <label className="grid gap-1">
          <span className="text-sm">User ID</span>
          <input className="border p-2 rounded" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
        <button disabled={loading} onClick={run} className="bg-black text-white px-4 py-2 rounded w-fit">{loading ? 'Embedding…' : 'Run Embedding'}</button>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {result && <pre className="text-xs bg-gray-100 p-2 border overflow-x-auto">{result}</pre>}
      </div>
    </div>
  );
}

