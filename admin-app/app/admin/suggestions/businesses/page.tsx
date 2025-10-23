"use client";
import { useEffect, useState } from "react";

export default function BusinessesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/list?limit=100${region ? `&region=${encodeURIComponent(region)}` : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'failed');
      setItems(json?.items ?? []);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function reembed(id: string) {
    try {
      setProcessing(id);
      if (!supabaseUrl) throw new Error('Supabase URL not configured');
      const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/svc-business-embed`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${anon}` },
        body: JSON.stringify({ business_id: id, reembed: true, limit: 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'embed failed');
      await load();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Businesses (Embedding)</h1>
      <div className="flex items-end gap-2">
        <label className="grid gap-1">
          <span className="text-sm">Region</span>
          <input className="border p-2 rounded" value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>
        <button onClick={load} className="bg-black text-white px-4 py-2 rounded">Reload</button>
      </div>
      {loading && <div>Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid gap-2">
        {items.map((b: any) => (
          <div key={b.id} className="border p-3 rounded flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">{b.name ?? b.id}</div>
              <div className="text-sm text-gray-600">{b.category ?? '-'} | {b.region ?? '-'}</div>
              <div className="text-xs">embedding: {b.embedding ? 'yes' : 'no'}</div>
            </div>
            <button disabled={processing === b.id} onClick={() => reembed(b.id)} className="border rounded px-3 py-1">
              {processing === b.id ? 'Embedding…' : 'Re-embed'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

