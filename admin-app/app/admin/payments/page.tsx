"use client";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { useToast } from "@/components/ui/ToastProvider";

export default function PaymentsPage() {
  const [amount, setAmount] = useState(1000);
  const [currency, setCurrency] = useState("RWF");
  const [userId, setUserId] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const { pushToast } = useToast();

  async function onInitiate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQrUrl(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase client not configured");
      const { data, error } = await supabase.functions.invoke("svc-payment-initiate", {
        body: { amount, currency, user_id: userId || undefined },
      });
      if (error) throw error;
      setQrUrl(data?.qr_url ?? null);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Initiate Payment (QR)</h1>
      <form onSubmit={onInitiate} className="grid gap-3 max-w-md">
        <label className="grid gap-1">
          <span className="text-sm">Amount</span>
          <input type="number" min={1} className="border p-2 rounded" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Currency</span>
          <input className="border p-2 rounded" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">User ID (optional for demo)</span>
          <input className="border p-2 rounded" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid of the user" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">WhatsApp Number (E.164, e.g. +2507…)</span>
          <input className="border p-2 rounded" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2507XXXXXXXX" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Template Name (optional; uses URL button)</span>
          <input className="border p-2 rounded" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. open_qr" />
        </label>
        <button disabled={loading} className="bg-black text-white px-4 py-2 rounded" type="submit">
          {loading ? "Generating…" : "Generate QR"}
        </button>
      </form>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {qrUrl && (
        <div className="space-y-2">
          <a href={qrUrl} target="_blank" rel="noreferrer" className="underline">Open QR</a>
          <div className="border p-3 inline-block">
            <img src={qrUrl} alt="Payment QR" className="w-64 h-64 object-contain" />
          </div>
          <div>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={!phone}
              onClick={async () => {
                setError(null);
                try {
                  const supabase = getSupabaseClient();
                  if (!supabase) throw new Error("Supabase client not configured");
                  const { error } = await supabase.functions.invoke("svc-whatsapp-send-qr", {
                    body: templateName
                      ? { to: phone, qr_url: qrUrl, template: templateName }
                      : { to: phone, qr_url: qrUrl },
                  });
                  if (error) throw error;
                  pushToast("Sent QR via WhatsApp", "success");
                } catch (err: any) {
                  setError(err?.message ?? String(err));
                }
              }}
            >
              {templateName ? "Send via Template Button" : "Send via WhatsApp"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
