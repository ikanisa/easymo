// deno-lint-ignore-file no-explicit-any
import QRCode from "npm:qrcode@1.5.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

type Payload = {
  amount: number;
  currency: string;
  user_id?: string; // optional; prefer from JWT if present
};

function json(res: ResponseInit, body: any) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...res,
  });
}

function parseAuthUser(req: Request): string | null {
  // Supabase functions forward JWT claims via Authorization: Bearer <jwt>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7);
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return json({ status: 405 }, { error: "method_not_allowed" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_URL_PUBLIC");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ status: 500 }, { error: "server_misconfigured" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ status: 400 }, { error: "invalid_json" });
  }

  const authUser = parseAuthUser(req);
  const userId = (payload.user_id || authUser) ?? null;
  if (!userId) {
    return json({ status: 401 }, { error: "missing_user" });
  }

  if (!payload.amount || !payload.currency) {
    return json({ status: 400 }, { error: "missing_amount_or_currency" });
  }

  try {
    // Create payment row
    const { data: paymentRow, error: insertErr } = await supabase
      .from("payments")
      .insert({ user_id: userId, amount: payload.amount, currency: payload.currency, status: "pending" })
      .select("id")
      .single();
    if (insertErr) throw insertErr;

    const paymentId = paymentRow.id as string;
    const qrPayload = JSON.stringify({ pid: paymentId, amount: payload.amount, currency: payload.currency });
    const dataUrl = await QRCode.toDataURL(qrPayload, { errorCorrectionLevel: "M", width: 512 });

    // Convert data URL to binary
    const base64 = dataUrl.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Ensure bucket exists (public)
    try {
      // @ts-ignore - storage admin bucket creation
      await (supabase.storage as any).createBucket("payments-qrcodes", { public: true });
    } catch (_) {
      // ignore if exists
    }

    const filename = `${paymentId}.png`;
    const { error: uploadErr } = await supabase.storage
      .from("payments-qrcodes")
      .upload(filename, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: pub } = supabase.storage.from("payments-qrcodes").getPublicUrl(filename);
    const qrUrl = pub.publicUrl;

    await supabase.from("payments").update({ qr_url: qrUrl }).eq("id", paymentId);

    return json({ status: 200 }, { ok: true, payment_id: paymentId, qr_url: qrUrl });
  } catch (err) {
    return json({ status: 500 }, { error: "payment_initiate_failed", details: String(err?.message ?? err) });
  }
}

// Deno Deploy / Supabase Edge entrypoint
// @ts-ignore
addEventListener("fetch", (e: FetchEvent) => e.respondWith(handler(e.request)));

