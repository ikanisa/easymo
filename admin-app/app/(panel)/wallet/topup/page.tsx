"use client";
import { useState } from 'react';
import { getAdminApiRoutePath } from "@/lib/routes";

export default function WalletTopupPage() {
  const [tenantId, setTenantId] = useState("");
  const [vendorAccountId, setVendorAccountId] = useState("");
  const [amount, setAmount] = useState("1000");
  const [currency, setCurrency] = useState("RWF");
  const [fx, setFx] = useState<any | null>(null);
  const [platformAccount, setPlatformAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function getFx(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setFx(null);
    try {
      const convertUrl = getAdminApiRoutePath("fxConvert");
      const res = await fetch(
        `${convertUrl}?amount=${encodeURIComponent(amount)}&currency=${encodeURIComponent(currency)}`,
      );
      const json = await res.json();
      if (res.ok) setFx(json);
      else setStatus(`FX failed: ${json.error || res.status}`);
    } catch (err) {
      setStatus(`FX error: ${(err as Error).message}`);
    }
  }

  async function provisionPlatform(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(getAdminApiRoutePath("walletPlatformProvision"), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });
    const json = await res.json();
    if (json?.ok) {
      setPlatformAccount(json.data?.account?.id || null);
      setStatus('Platform wallet ready.');
    } else setStatus(`Provision failed: ${json?.data?.error || json?.error || res.status}`);
  }

  async function topUp(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!platformAccount) { setStatus('Provision platform wallet first.'); return; }
    if (!fx?.tokens) { setStatus('Fetch FX first.'); return; }
    const res = await fetch(getAdminApiRoutePath("walletTransfer"), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        sourceAccountId: platformAccount,
        destinationAccountId: vendorAccountId,
        amount: fx.tokens,
        currency: 'USD',
        reference: `topup/${currency}/${amount}`,
      }),
    });
    const json = await res.json();
    if (json?.ok) setStatus('Top-up succeeded.');
    else setStatus(`Top-up failed: ${json?.data?.error || json?.error || res.status}`);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Wallet Top-up</h1>
      <p className="text-sm text-slate-600">Convert local currency to tokens (USD‑pegged) and credit vendor wallet.</p>

      <form onSubmit={getFx} className="grid gap-2 max-w-xl">
        <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Tenant ID (uuid)" className="border p-2" required />
        <input value={vendorAccountId} onChange={(e) => setVendorAccountId(e.target.value)} placeholder="Vendor Wallet Account ID (uuid)" className="border p-2" required />
        <div className="grid grid-cols-2 gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="border p-2" required />
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Currency (e.g., RWF)" className="border p-2" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white px-3 py-2 rounded">Get FX</button>
          <button onClick={provisionPlatform} className="bg-indigo-600 text-white px-3 py-2 rounded">Provision Platform Wallet</button>
          <button onClick={topUp} className="bg-emerald-600 text-white px-3 py-2 rounded">Top Up</button>
        </div>
      </form>

      {status && <p className="text-sm">{status}</p>}
      {fx && (
        <pre className="bg-gray-100 p-3 text-xs overflow-x-auto border">{JSON.stringify(fx, null, 2)}</pre>
      )}
    </div>
  );
}

export const runtime = "edge";
