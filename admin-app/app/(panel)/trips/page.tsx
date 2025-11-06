"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from "react";
import { getAdminApiRoutePath } from "@/lib/routes";

export default function TripsPage() {
  const [data, setData] = useState<{ data: any[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const tripsUrl = getAdminApiRoutePath("trips");

  const load = useCallback(async (params?: { search?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", "50");
      if (params?.search) sp.set("search", params.search);
      const res = await fetch(`${tripsUrl}?${sp.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [tripsUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Trips</h1>
      {error && (
        <div className="text-red-600 text-sm">Failed to load trips: {error}</div>
      )}
      <div className="text-sm text-slate-600">Platform trips (most recent first)</div>
      <form
        className="flex gap-2 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          void load({ search });
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by trip id, user, vehicle..."
          className="border px-2 py-1 rounded w-64"
        />
        <button type="submit" className="bg-slate-700 text-white px-3 py-1 rounded disabled:opacity-50" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
        <button type="button" onClick={() => { setSearch(""); void load(); }} className="px-3 py-1 rounded border">
          Refresh
        </button>
      </form>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 border rounded">Open Trips<br/><b>{data?.data?.filter((t:any)=>t?.status===null||t?.status==='open').length ?? 0}</b></div>
        <div className="p-3 border rounded">Expired<br/><b>{data?.data?.filter((t:any)=>t?.status==='expired').length ?? 0}</b></div>
        <div className="p-3 border rounded">Total<br/><b>{data?.total ?? 0}</b></div>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2">Trip ID</th>
              <th className="text-left p-2">User</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Vehicle</th>
              <th className="text-left p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((t: any) => (
              <tr key={String(t.id)} className="border-t">
                <td className="p-2 font-mono text-xs">{String(t.id)}</td>
                <td className="p-2 text-xs">{String(t.creator_user_id ?? '')}</td>
                <td className="p-2 text-xs">{String(t.status ?? 'open')}</td>
                <td className="p-2 text-xs">{String(t.vehicle_type ?? '')}</td>
                <td className="p-2 text-xs">{String(t.created_at ?? '')}</td>
              </tr>
            ))}
            {!data?.data?.length && (
              <tr><td className="p-4 text-slate-500" colSpan={5}>No trips found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const runtime = "edge";
