"use client";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

export default function SendQrTemplatePage() {
  const [to, setTo] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [template, setTemplate] = useState("open_qr");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase client not configured");
      const { data, error } = await supabase.functions.invoke("svc-whatsapp-send-qr", {
        body: template?.trim() ? { to, qr_url: qrUrl, template } : { to, qr_url: qrUrl },
      });
      if (error) throw error;
      if (data?.ok) setOk("Sent");
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Send QR via WhatsApp</h1>
      <p className="text-sm text-muted-foreground">
        Provide a recipient and QR URL. If a template name is set (e.g. open_qr), a URL button template is used; otherwise an image-only message is sent.
      </p>
      <form onSubmit={onSend} className="grid gap-3 max-w-lg">
        <label className="grid gap-1">
          <span className="text-sm">To (E.164, e.g. +2507…)</span>
          <input className="border p-2 rounded" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+2507XXXXXXXX" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">QR URL</span>
          <input className="border p-2 rounded" value={qrUrl} onChange={(e) => setQrUrl(e.target.value)} placeholder="https://…/qr.png" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Template (optional)</span>
          <input className="border p-2 rounded" value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="open_qr" />
        </label>
        <button disabled={loading || !to || !qrUrl} className="bg-black text-white px-4 py-2 rounded" type="submit">
          {loading ? "Sending…" : (template ? "Send via Template" : "Send Image")}
        </button>
      </form>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {ok && <div className="text-sm text-green-700">{ok}</div>}
    </div>
  );
}

