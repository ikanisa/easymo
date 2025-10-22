"use client";
import { useState } from 'react';
import { getAdminApiRoutePath } from "@/lib/routes";

export default function SubscriptionsPage() {
  const [tenantId, setTenantId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<any | null>(null);

  async function checkEntitlements(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const entitlementsUrl = getAdminApiRoutePath("subscriptionEntitlements");
    const res = await fetch(
      `${entitlementsUrl}?tenantId=${encodeURIComponent(tenantId)}&vendorId=${encodeURIComponent(vendorId)}`,
    );
    const json = await res.json();
    if (json?.ok) setEntitlements(json.data);
    else setStatus(`Failed: ${json?.data?.error || json?.error || res.status}`);
  }

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(getAdminApiRoutePath("subscriptionSubscribe"), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, vendorId, tokens: 4 }),
    });
    const json = await res.json();
    if (json?.ok) setStatus('Subscription charged.');
    else setStatus(`Failed: ${json?.data?.error || json?.error || res.status}`);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Subscriptions</h1>
      <p className="text-sm text-slate-600">Manage vendor subscriptions. First 30 contacts are free; then $4/month (4 tokens).</p>

      <form onSubmit={checkEntitlements} className="grid gap-2 max-w-xl">
        <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Tenant ID (uuid)" className="border p-2" required />
        <input value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Vendor ID (uuid)" className="border p-2" required />
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white px-3 py-2 rounded">Check Entitlements</button>
          <button onClick={subscribe} className="bg-emerald-600 text-white px-3 py-2 rounded">Charge $4 Subscription</button>
        </div>
      </form>

      {status && <p className="text-sm">{status}</p>}
      {entitlements && (
        <pre className="bg-gray-100 p-3 text-xs overflow-x-auto border">{JSON.stringify(entitlements, null, 2)}</pre>
      )}
    </div>
  );
}

