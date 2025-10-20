"use client";

import { useState } from "react";

type JsonValue = unknown;

const pretty = (value: JsonValue) => JSON.stringify(value, null, 2);

export default function AgentsPage() {
  const [orchestrateResp, setOrchestrateResp] = useState<JsonValue>(null);
  const [settleResp, setSettleResp] = useState<JsonValue>(null);
  const [attribResp, setAttribResp] = useState<JsonValue>(null);
  const [attribError, setAttribError] = useState<string | null>(null);
  const [reconResp, setReconResp] = useState<JsonValue>(null);
  const [reconError, setReconError] = useState<string | null>(null);

  async function runOrchestrate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const categoriesRaw = String(form.get("categories") || "");
    const payload = {
      tenantId: String(form.get("tenantId")),
      buyerId: String(form.get("buyerId")),
      msisdn: String(form.get("msisdn")),
      region: String(form.get("region") || ""),
      categories: categoriesRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      intentPayload: {},
    };
    const res = await fetch("/api/ai/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setOrchestrateResp({ ok: res.ok, data });
  }

  async function runSettlement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      purchaseId: String(form.get("purchaseId")),
      amount: Number(form.get("amount")),
      currency: String(form.get("currency")),
    };
    const res = await fetch("/api/ai/settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSettleResp({ ok: res.ok, data });
  }

  async function runAttribution(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttribError(null);
    const form = new FormData(e.currentTarget);
    try {
      const parseJson = (raw: string | null) => {
        if (!raw) return undefined;
        const trimmed = raw.trim();
        if (!trimmed) return undefined;
        return JSON.parse(trimmed);
      };

      const payload = {
        quoteId: String(form.get("quoteId")),
        referrals: parseJson(String(form.get("referrals") || "")) ?? [],
        events: parseJson(String(form.get("events") || "")) ?? [],
        persist: form.get("persist") === "on",
        evidence: parseJson(String(form.get("evidence") || "")),
        dispute: (() => {
          const reason = String(form.get("disputeReason") || "").trim();
          const actor = String(form.get("disputeActor") || "").trim();
          if (!reason || !actor) return undefined;
          return { reason, actor };
        })(),
      };

      const res = await fetch("/api/ai/attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      setAttribResp({ ok: res.ok, data });
      if (!res.ok) {
        setAttribError("Attribution request failed");
      }
    } catch (err) {
      setAttribError(`Invalid JSON input: ${(err as Error).message}`);
    }
  }

  async function runReconciliation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReconError(null);
    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File | null;
    if (!file) {
      setReconError("Please select a CSV file");
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
      const res = await fetch("/api/ai/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64 }),
      });
      const data = await res.json().catch(() => ({}));
      setReconResp({ ok: res.ok, data });
      if (!res.ok) {
        setReconError("Reconciliation request failed");
      }
    } catch (err) {
      setReconError(`Failed to read file: ${(err as Error).message}`);
    }
  }

  return (
    <div className="p-6 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">AI Agents Playground</h1>
        <p className="text-sm text-slate-600">
          Trigger broker orchestration, settlement, attribution, and reconciliation flows directly against the agent runtime.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Broker Orchestrator</h2>
        <form onSubmit={runOrchestrate} className="grid gap-2 max-w-xl">
          <input name="tenantId" placeholder="Tenant ID (uuid)" className="border p-2" required />
          <input name="buyerId" placeholder="Buyer ID (uuid)" className="border p-2" required />
          <input name="msisdn" placeholder="Buyer MSISDN (+250...)" className="border p-2" required />
          <input name="region" placeholder="Region (e.g., rw-kigali)" className="border p-2" />
          <input name="categories" placeholder="Categories (comma separated)" className="border p-2" />
          <button type="submit" className="bg-black text-white px-4 py-2 rounded">Run Orchestrate</button>
        </form>
        {orchestrateResp && (
          <pre className="bg-gray-100 p-3 text-xs overflow-x-auto border">{pretty(orchestrateResp)}</pre>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Settlement</h2>
        <form onSubmit={runSettlement} className="grid gap-2 max-w-xl">
          <input name="purchaseId" placeholder="Purchase ID (uuid)" className="border p-2" required />
          <input name="amount" placeholder="Amount" className="border p-2" required />
          <input name="currency" placeholder="Currency (e.g., USD)" className="border p-2" defaultValue="USD" required />
          <button type="submit" className="bg-black text-white px-4 py-2 rounded">Run Settlement</button>
        </form>
        {settleResp && (
          <pre className="bg-gray-100 p-3 text-xs overflow-x-auto border">{pretty(settleResp)}</pre>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Attribution</h2>
        <form onSubmit={runAttribution} className="grid gap-2 max-w-xl">
          <input name="quoteId" placeholder="Quote ID (uuid)" className="border p-2" required />
          <textarea name="referrals" placeholder='Referrals JSON (optional)
Example: ["ctwa:endorser-99"]' className="border p-2 min-h-[80px]" />
          <textarea name="events" placeholder='Events JSON (optional)
Example: [{"type":"CONTACT_ENDORSER","actorId":"endorser-99","timestamp":"2025-01-01T10:00:00Z"}]' className="border p-2 min-h-[100px]" />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="persist" defaultChecked /> Persist on quote
          </label>
          <textarea name="evidence" placeholder='Evidence JSON (optional)
Example: [{"kind":"whatsapp_message","ref":"abc"}]' className="border p-2 min-h-[100px]" />
          <div className="grid grid-cols-2 gap-2">
            <input name="disputeReason" placeholder="Dispute reason (optional)" className="border p-2" />
            <input name="disputeActor" placeholder="Dispute actor ID" className="border p-2" />
          </div>
          <button type="submit" className="bg-black text-white px-4 py-2 rounded">Evaluate Attribution</button>
        </form>
        {attribError && <p className="text-sm text-red-600">{attribError}</p>}
        {attribResp && (
          <pre className="bg-gray-100 p-3 text-xs overflow-x-auto border">{pretty(attribResp)}</pre>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Reconciliation</h2>
        <form onSubmit={runReconciliation} className="grid gap-2 max-w-xl">
          <input type="file" name="file" accept=".csv" className="border p-2" required />
          <button type="submit" className="bg-black text-white px-4 py-2 rounded">Process CSV</button>
        </form>
        {reconError && <p className="text-sm text-red-600">{reconError}</p>}
        {reconResp && (
          <pre className="bg-gray-100 p-3 text-xs overflow-x-auto border">{pretty(reconResp)}</pre>
        )}
      </section>
    </div>
  );
}

