import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function envAny(keys: string[], required = true): string {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim()) return v.trim();
  }
  if (required) throw new Error(`Missing env var: ${keys.join(" or ")}`);
  return "";
}

const SUPABASE_URL = envAny(["SUPABASE_URL"]);
const SUPABASE_SERVICE_ROLE_KEY = envAny(["SUPABASE_SERVICE_ROLE_KEY"]);

const WA_PHONE_NUMBER_ID = envAny([
  "WHATSAPP_PHONE_NUMBER_ID",
  "WA_PHONE_NUMBER_ID",
  "WA_PHONE_ID",
  "WABA_PHONE_NUMBER_ID",
]);

const WA_ACCESS_TOKEN = envAny([
  "WHATSAPP_ACCESS_TOKEN",
  "WA_ACCESS_TOKEN",
  "WA_TOKEN",
  "WABA_ACCESS_TOKEN",
]);

const WA_VERIFY_TOKEN = envAny([
  "WHATSAPP_VERIFY_TOKEN",
  "WA_VERIFY_TOKEN",
], false);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function truncate(s: string, n: number) {
  if (!s) return s;
  return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + "…";
}

function formatDistance(distanceM: number) {
  const km = distanceM / 1000;
  if (km < 1) return `${Math.round(distanceM)} m`;
  return `${km.toFixed(1)} km`;
}

async function waSend(payload: unknown) {
  const url = `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("WA send failed:", res.status, text);
  }
}

async function sendHome(to: string) {
  await waSend({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Home menu" },
      action: {
        button: "Open",
        sections: [
          {
            title: "Services",
            rows: [
              { id: "home_rides", title: "Rides", description: "Find nearby drivers/passengers" },
            ],
          },
        ],
      },
    },
  });
}

async function sendRoleMenu(to: string) {
  await waSend({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Choose your role" },
      action: {
        button: "Select",
        sections: [
          {
            title: "Mobility",
            rows: [
              { id: "role_driver", title: "Driver", description: "See nearby passengers" },
              { id: "role_passenger", title: "Passenger", description: "See nearby drivers" },
            ],
          },
        ],
      },
    },
  });
}

async function askLocation(to: string, role: "driver" | "passenger") {
  await waSend({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body:
        `✅ Role set: ${role.toUpperCase()}\n\n` +
        `Now share your *current location*:\n` +
        `📎 Attach → Location → Send your current location\n\n` +
        `Then I'll show you the nearest 9 ${role === "driver" ? "passengers" : "drivers"}.`,
    },
  });
}

async function sendNearbyList(
  to: string,
  targetRole: "driver" | "passenger",
  items: Array<{ wa_id: string; display_name: string | null; distance_m: number; last_seen: string }>,
) {
  const rows = items.slice(0, 9).map((x) => {
    const title = truncate((x.display_name || "").trim() || x.wa_id, 24);
    const desc = truncate(`${formatDistance(x.distance_m)} away`, 72);
    return { id: `pick:${x.wa_id}`, title, description: desc };
  });

  if (rows.length === 0) {
    await waSend({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: `No nearby ${targetRole}s found. Share your location again in a minute.` },
    });
    return;
  }

  await waSend({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: `Nearest ${rows.length} ${targetRole}s` },
      action: { button: "Choose", sections: [{ title: "Nearby", rows }] },
    },
  });
}

async function sendWaLink(to: string, targetWaId: string) {
  const link = `https://wa.me/${targetWaId}?text=${encodeURIComponent(
    "Hi! I found you via easyMO mobility. Are you available?",
  )}`;
  await waSend({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: `Here's the contact link:\n${link}` },
  });
}

/**
 * Accept both:
 * - Raw Meta payload: body.entry[0].changes[0].value.messages[0]
 * - Forwarded payloads: body.value.messages[0], body.messages[0], body.msg, body.message
 */
function extractIncoming(body: any): { msg: any; contact: any } {
  const value =
    body?.entry?.[0]?.changes?.[0]?.value ??
    body?.value ??
    body;

  const msg =
    value?.messages?.[0] ??
    body?.messages?.[0] ??
    body?.msg ??
    body?.message ??
    null;

  const contact =
    value?.contacts?.[0] ??
    body?.contacts?.[0] ??
    body?.contact ??
    null;

  return { msg, contact };
}

function interactiveId(msg: any): string {
  return (
    msg?.interactive?.list_reply?.id ||
    msg?.interactive?.button_reply?.id ||
    msg?.list_reply?.id ||
    msg?.button_reply?.id ||
    msg?.payload?.id ||
    ""
  );
}

function normalizeAction(idRaw: string): string {
  const id = String(idRaw || "").trim();

  // Home -> Rides synonyms (to match whatever core/router used previously)
  if (["home_rides", "rides", "mobility", "rides_agent", "rides_menu"].includes(id)) return "home_rides";

  // Role synonyms
  if (["role_driver", "driver", "as_driver", "i_am_driver"].includes(id)) return "role_driver";
  if (["role_passenger", "passenger", "as_passenger", "i_am_passenger"].includes(id)) return "role_passenger";

  return id;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Health endpoint for runbooks/monitoring
  if (req.method === "GET" && (url.pathname.endsWith("/health") || url.pathname === "/health")) {
    return Response.json({
      ok: true,
      env: {
        SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        WHATSAPP_PHONE_NUMBER_ID: !!Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"),
        WHATSAPP_ACCESS_TOKEN: !!Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
        WHATSAPP_VERIFY_TOKEN: !!Deno.env.get("WHATSAPP_VERIFY_TOKEN"),
        WA_PHONE_NUMBER_ID: !!Deno.env.get("WA_PHONE_NUMBER_ID") || !!Deno.env.get("WA_PHONE_ID"),
        WA_ACCESS_TOKEN: !!Deno.env.get("WA_ACCESS_TOKEN") || !!Deno.env.get("WA_TOKEN"),
        WA_VERIFY_TOKEN: !!Deno.env.get("WA_VERIFY_TOKEN"),
      },
    });
  }

  // Meta verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge && WA_VERIFY_TOKEN && token === WA_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { msg, contact } = extractIncoming(body);
  if (!msg?.from) return new Response("OK", { status: 200 });

  const from = String(msg.from);
  const displayName = String(contact?.profile?.name || contact?.name || "");

  await supabase.rpc("mobility_touch_user", { p_wa_id: from, p_display_name: displayName });

  // TEXT -> always Home (simple)
  if (msg.type === "text") {
    await supabase.from("mobility_users").update({ flow_state: "home" }).eq("wa_id", from);
    await sendHome(from);
    return new Response("OK", { status: 200 });
  }

  // INTERACTIVE selections
  if (msg.type === "interactive" || msg.interactive) {
    const raw = interactiveId(msg);
    const id = normalizeAction(raw);

    if (id === "home_rides") {
      await supabase.from("mobility_users").update({ flow_state: "choose_role" }).eq("wa_id", from);
      await sendRoleMenu(from);
      return new Response("OK", { status: 200 });
    }

    if (id === "role_driver" || id === "role_passenger") {
      const role = id === "role_driver" ? "driver" : "passenger";
      await supabase.rpc("mobility_set_flow", { p_wa_id: from, p_role: role, p_flow_state: "await_location" });
      await askLocation(from, role);
      return new Response("OK", { status: 200 });
    }

    if (String(id).startsWith("pick:")) {
      const target = String(id).slice("pick:".length);
      await sendWaLink(from, target);
      return new Response("OK", { status: 200 });
    }

    await sendHome(from);
    return new Response("OK", { status: 200 });
  }

  // LOCATION -> upsert presence + find nearest 9 opposite role
  if (msg.type === "location" || msg.location) {
    const lat = Number(msg.location?.latitude);
    const lng = Number(msg.location?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      await waSend({
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: { body: "I couldn't read that location. Please share your current location again (Attach → Location)." },
      });
      return new Response("OK", { status: 200 });
    }

    const { data: me } = await supabase
      .from("mobility_users")
      .select("role_pref")
      .eq("wa_id", from)
      .maybeSingle();

    const rolePref = (me?.role_pref as ("driver" | "passenger" | null)) ?? null;
    if (!rolePref) {
      await sendRoleMenu(from);
      return new Response("OK", { status: 200 });
    }

    await supabase.rpc("mobility_upsert_presence", { p_wa_id: from, p_role: rolePref, p_lat: lat, p_lng: lng });

    const targetRole = rolePref === "driver" ? "passenger" : "driver";

    let { data: nearby } = await supabase.rpc("mobility_find_nearby", {
      p_wa_id: from,
      p_target_role: targetRole,
      p_lat: lat,
      p_lng: lng,
      p_limit: 9,
      p_max_km: 5,
      p_ttl_minutes: 30,
    });

    if (!nearby || nearby.length === 0) {
      ({ data: nearby } = await supabase.rpc("mobility_find_nearby", {
        p_wa_id: from,
        p_target_role: targetRole,
        p_lat: lat,
        p_lng: lng,
        p_limit: 9,
        p_max_km: 15,
        p_ttl_minutes: 30,
      }));
    }

    await sendNearbyList(from, targetRole, (nearby || []) as any[]);
    return new Response("OK", { status: 200 });
  }

  // Anything else -> Home
  await sendHome(from);
  return new Response("OK", { status: 200 });
});
