// Sends a WhatsApp image message pointing to a hosted QR code URL.
// Expects environment variables:
// - WABA_ACCESS_TOKEN (WhatsApp Business API token)
// - WABA_PHONE_NUMBER_ID (Sender phone number ID)
// Payload: { to: string; qr_url: string; caption?: string }

type SendPayload = { to: string; qr_url: string; caption?: string };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sendImage(to: string, link: string, caption?: string) {
  const token = Deno.env.get("WABA_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WABA_PHONE_NUMBER_ID");
  if (!token || !phoneId) throw new Error("waba_env_missing");
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link, caption },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`waba_send_failed:${res.status}:${text}`);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  let payload: SendPayload | null = null;
  try {
    payload = (await req.json()) as SendPayload;
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const to = (payload?.to ?? "").trim();
  const qrUrl = (payload?.qr_url ?? "").trim();
  const caption = payload?.caption ?? "";
  if (!to || !qrUrl) return json(400, { error: "missing_to_or_qr_url" });

  try {
    await sendImage(to, qrUrl, caption);
    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: String(err?.message ?? err) });
  }
}

// Edge entrypoint
// @ts-ignore
addEventListener("fetch", (e: FetchEvent) => e.respondWith(handler(e.request)));

