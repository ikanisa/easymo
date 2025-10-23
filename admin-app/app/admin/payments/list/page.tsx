"use client";
import { useEffect, useState } from "react";

export default function PaymentsListPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/payments/list');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'failed');
        setItems(json?.items ?? []);
      } catch (err: any) {
        setError(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Payments (Latest)</h1>
      {loading && <div>Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid gap-2">
        {items.map((p: any) => (
          <div key={p.id} className="border p-3 rounded">
            <div className="text-sm">{p.id}</div>
            <div className="text-sm">{p.amount} {p.currency} · {p.status}</div>
            <div className="text-xs text-gray-600">{new Date(p.created_at).toLocaleString()}</div>
            {p.qr_url && (<a className="underline text-xs" target="_blank" rel="noreferrer" href={p.qr_url}>Open QR</a>)}
          </div>
        ))}
      </div>
    </div>
  );
}

