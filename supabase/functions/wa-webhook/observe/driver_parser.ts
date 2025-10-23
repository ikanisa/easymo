import type { RouterContext, WhatsAppMessage } from "../types.ts";
import { getTextBody, isLocationMessage, isTextMessage } from "../utils/messages.ts";

function appBase(): string {
  return Deno.env.get("BROKER_APP_BASE_URL") ??
    Deno.env.get("NEXT_PUBLIC_APP_URL") ??
    "http://localhost:8080";
}

function buildHeaders(msgId?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (msgId) headers["Idempotency-Key"] = msgId;
  return headers;
}

export async function maybeHandleDriverText(
  ctx: RouterContext,
  msg: WhatsAppMessage,
): Promise<boolean> {
  if (!isTextMessage(msg)) return false;
  const body = getTextBody(msg);
  if (!body) return false;

  // Pattern: OK <eta_minutes> <offer_price>
  const ok = body.match(/^OK\s+(\d{1,3})\s+(\d{3,7})$/i);
  if (ok) {
    const eta = Number(ok[1]);
    const price = Number(ok[2]);
    const { data: driver } = await ctx.supabase
      .from("drivers")
      .select("id")
      .eq("phone_e164", ctx.from)
      .maybeSingle();
    const driver_id = driver?.id ?? null;
    const payload = {
      ride_id: null,
      driver_id,
      eta_minutes: eta,
      offer_price: price,
      note: "OK",
    };
    try {
      await fetch(`${appBase()}/api/mobility/collect_offer`, {
        method: "POST",
        headers: buildHeaders(msg.id),
        body: JSON.stringify(payload),
      });
    } catch (_) {
      // best-effort; do not impact router flow
    }
    return false; // non-blocking; allow normal flow to continue
  }

  // Pattern: NO / DECLINE
  if (/^(NO|DECLINE)$/i.test(body)) {
    const { data: driver } = await ctx.supabase
      .from("drivers")
      .select("id")
      .eq("phone_e164", ctx.from)
      .maybeSingle();
    const driver_id = driver?.id ?? null;
    const payload = {
      ride_id: null,
      driver_id,
      eta_minutes: null,
      offer_price: null,
      note: "rejected",
    };
    try {
      await fetch(`${appBase()}/api/mobility/collect_offer`, {
        method: "POST",
        headers: buildHeaders(msg.id),
        body: JSON.stringify(payload),
      });
    } catch (_) {
      // best-effort
    }
    return false;
  }

  return false;
}

export async function maybeHandleDriverLocation(
  ctx: RouterContext,
  msg: WhatsAppMessage,
): Promise<boolean> {
  if (!isLocationMessage(msg)) return false;
  const rawLat = msg.location?.latitude;
  const rawLng = msg.location?.longitude;
  const lat = typeof rawLat === "number"
    ? rawLat
    : typeof rawLat === "string"
    ? Number.parseFloat(rawLat)
    : Number.NaN;
  const lng = typeof rawLng === "number"
    ? rawLng
    : typeof rawLng === "string"
    ? Number.parseFloat(rawLng)
    : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const payload = {
    driver_phone_e164: ctx.from,
    lat,
    lng,
    available: true,
  };
  try {
    await fetch(`${appBase()}/api/mobility/driver_location`, {
      method: "POST",
      headers: buildHeaders(msg.id),
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // best-effort
  }
  return false;
}
