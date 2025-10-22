"use client";
import { useEffect, useState } from 'react';
import { getAdminApiPath } from "@/lib/routes";

export default function MarketplaceSettingsPage() {
  const [tenantId, setTenantId] = useState("");
  const [freeContacts, setFreeContacts] = useState<number>(30);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [subscriptionTokens, setSubscriptionTokens] = useState<number>(4);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
  }, [tenantId]);

  async function load(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(
      `${getAdminApiPath("marketplace", "settings")}?tenantId=${encodeURIComponent(tenantId)}`,
    );
    const json = await res.json();
    if (json?.ok) {
      const d = json.data;
      setFreeContacts(d.freeContacts ?? 30);
      setWindowDays(d.windowDays ?? 30);
      setSubscriptionTokens(d.subscriptionTokens ?? 4);
      setStatus('Loaded');
    } else setStatus(`Load failed: ${json?.data?.error || json?.error || res.status}`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(getAdminApiPath("marketplace", "settings"), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, freeContacts, windowDays, subscriptionTokens }),
    });
    const json = await res.json();
    if (json?.ok) setStatus('Saved');
    else setStatus(`Save failed: ${json?.data?.error || json?.error || res.status}`);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Marketplace Settings</h1>
      <p className="text-sm text-slate-600">Adjust vendor entitlements and subscription token amount for this tenant.</p>

      <form onSubmit={load} className="grid gap-2 max-w-xl">
        <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Tenant ID (uuid)" className="border p-2" required />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm">
            Free Contacts
            <input type="number" min={0} value={freeContacts} onChange={(e) => setFreeContacts(Number(e.target.value))} className="border p-2 w-full" />
          </label>
          <label className="text-sm">
            Window (days)
            <input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className="border p-2 w-full" />
          </label>
          <label className="text-sm">
            Subscription Tokens
            <input type="number" min={1} value={subscriptionTokens} onChange={(e) => setSubscriptionTokens(Number(e.target.value))} className="border p-2 w-full" />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white px-3 py-2 rounded">Load</button>
          <button onClick={save} className="bg-emerald-600 text-white px-3 py-2 rounded">Save</button>
        </div>
      </form>

      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}

