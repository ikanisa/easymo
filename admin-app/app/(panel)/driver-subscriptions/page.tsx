"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";

export default function DriverSubscriptionsPage() {
  const [data, setData] = useState<{ data: any[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(params?: { search?: string }) {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", "200");
      if (params?.search) sp.set("search", params.search);
      const res = await fetch(`/api/subscriptions?${sp.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = data?.data ?? [];
  const pending = rows.filter((r:any)=>r.status==='pending').length;
  const activeCount = rows.filter((r:any)=>r.status==='active').length;
  const expired = rows.filter((r:any)=>r.status==='expired').length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Driver Subscriptions</h1>
      <div className="text-sm text-slate-600">Manage driver subscription payments</div>
      {error && (<div className="text-red-600 text-sm">Failed to load subscriptions: {error}</div>)}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 border rounded">Pending Review<br/><b>{pending}</b></div>
        <div className="p-3 border rounded">Active<br/><b>{activeCount}</b></div>
        <div className="p-3 border rounded">Expired<br/><b>{expired}</b></div>
        <div className="p-3 border rounded">Total Revenue<br/><b>{0}</b> <span className="text-xs">RWF</span></div>
      </div>
      <form
        className="flex gap-2 items-center"
        onSubmit={(e) => { e.preventDefault(); void load({ search }); }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user, txn id, status..."
          className="border px-2 py-1 rounded w-80"
        />
        <button type="submit" className="bg-slate-700 text-white px-3 py-1 rounded disabled:opacity-50" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
        <button type="button" onClick={() => { setSearch(""); void load(); }} className="px-3 py-1 rounded border">
          Refresh
        </button>
      </form>
      <div className="overflow-auto border rounded mt-2">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">User</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Amount</th>
              <th className="text-left p-2">Transaction ID</th>
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2">Expires</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: any, i: number) => (
              <tr key={String(s.id ?? i)} className="border-t">
                <td className="p-2 text-xs">{String(s.user_id ?? '')}</td>
                <td className="p-2 text-xs">{String(s.status ?? '')}</td>
                <td className="p-2 text-xs">{String(s.amount ?? '')}</td>
                <td className="p-2 text-xs">{String(s.txn_id ?? '')}</td>
                <td className="p-2 text-xs">{String(s.created_at ?? '')}</td>
                <td className="p-2 text-xs">{String(s.expires_at ?? '')}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="p-4 text-slate-500" colSpan={6}>No subscriptions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
