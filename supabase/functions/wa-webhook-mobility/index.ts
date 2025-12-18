import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { claimEvent } from "../_shared/wa-webhook-shared/state/idempotency.ts";

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
const WA_APP_SECRET = envAny([
  "WHATSAPP_APP_SECRET",
  "WA_APP_SECRET",
], false);
const ALLOW_UNSIGNED = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false")
  .toLowerCase() === "true";

const WA_BOT_NUMBER_E164 = envAny([
  "WA_BOT_NUMBER_E164",
  "WHATSAPP_PHONE_NUMBER_E164",
], false) || "+22893002751";

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
    await logStructuredEvent("MOBILITY_WHATSAPP_SEND_FAILED", {
      status: res.status,
      error: text.slice(0, 200), // Limit error message length
    }, "error");
  }
}

/**
 * Send message with action buttons (Share easyMO + Home)
 * If message already has interactive buttons/list, use those instead
 */
async function sendWithActionButtons(
  to: string,
  body: string,
  existingButtons?: Array<{ id: string; title: string }>,
) {
  if (existingButtons && existingButtons.length > 0) {
    // Use existing buttons
    await waSend({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: existingButtons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    });
  } else {
    // Add default Share easyMO + Home buttons
    await waSend({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: [
            { type: "reply", reply: { id: "share_easymo", title: "🔗 Share easyMO" } },
            { type: "reply", reply: { id: "home", title: "🏠 Home" } },
          ],
        },
      },
    });
  }
}

/**
 * Ensure user exists in whatsapp_users table and has a profile
 * Returns user record, profile_id, and whether it was newly created
 */
async function ensureWhatsAppUser(
  phone: string,
  displayName: string,
): Promise<{ user: any; profileId: string | null; isNew: boolean }> {
  // Use RPC function to get or create user (handles both whatsapp_users and profiles)
  try {
    const { data: waUser, error } = await supabase.rpc("get_or_create_user", {
      p_phone: phone,
      p_name: displayName || null,
      p_language: "en",
      p_country: "RW",
    });

    if (error) {
      await logStructuredEvent("MOBILITY_GET_OR_CREATE_USER_ERROR", {
        phone: phone.slice(-4), // Mask phone
        error: error.message || String(error),
      }, "error");
      // Fallback: try direct insert
      const { data: newUser } = await supabase
        .from("whatsapp_users")
        .insert({
          phone,
          name: displayName || null,
          language: "en",
          country: "RW",
          last_seen_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      return { 
        user: newUser || { phone, id: null }, 
        profileId: newUser?.profile_id || null,
        isNew: true 
      };
    }

    // Check if this was a new user (created_at is recent)
    const isNew = waUser && new Date(waUser.created_at) > new Date(Date.now() - 60000); // Created in last minute
    
    // Get profile_id
    let profileId = waUser?.profile_id || null;
    if (!profileId) {
      // Try to find profile by phone
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .or(`wa_id.eq.${phone.replace(/^\+/, '')},phone_number.eq.${phone.startsWith('+') ? phone : `+${phone}`},phone_number.eq.${phone}`)
        .maybeSingle();
      profileId = profile?.user_id || null;
    }

    return { user: waUser, profileId, isNew: !!isNew };
  } catch (error) {
    await logStructuredEvent("MOBILITY_ENSURE_USER_ERROR", {
      phone: phone.slice(-4), // Mask phone
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return { user: { phone, id: null }, profileId: null, isNew: true };
  }
}

/**
 * Check if message contains referral code and process it
 * Returns true if referral was processed
 */
async function processReferralCode(
  phone: string,
  messageText: string,
  profileId: string | null,
): Promise<boolean> {
  const text = String(messageText || "").trim().toUpperCase();
  
  // Check for referral code patterns: "EASYMO REF CODE" or "REF CODE" or standalone code
  let code = "";
  if (text.includes("EASYMO REF")) {
    const match = text.match(/EASYMO\s+REF\s+([A-Z0-9]{4,12})/);
    if (match) code = match[1];
  } else if (text.startsWith("REF")) {
    const match = text.match(/REF[:\s]+([A-Z0-9]{4,12})/);
    if (match) code = match[1];
  } else if (/^[A-Z0-9]{6,12}$/.test(text)) {
    // Standalone code (6-12 alphanumeric)
    code = text;
  }

  if (!code) return false;

  // Need profile_id to process referral - if not provided, can't process
  if (!profileId) {
    await logStructuredEvent("MOBILITY_REFERRAL_NO_PROFILE", {
      phone: phone.slice(-4), // Mask phone
    }, "warn");
    return false;
  }

  try {
    // Apply referral code using RPC function
    const { data, error } = await supabase.rpc("referral_apply_code_v2", {
      _joiner_profile_id: profileId,
      _code: code,
      _joiner_whatsapp: phone,
      _idempotency_key: `mobility_${phone}_${Date.now()}`,
    });

    if (error) {
      await logStructuredEvent("MOBILITY_REFERRAL_APPLY_ERROR", {
        phone: phone.slice(-4), // Mask phone
        code: code,
        error: error.message || String(error),
      }, "error");
      return false;
    }

    // Check if referral was applied and tokens were awarded
    if (data && Array.isArray(data) && data.length > 0) {
      const result = data[0];
      if (result.applied && result.tokens_awarded > 0) {
        // Send notification to referrer
        const referrerPhone = result.promoter_whatsapp;
        if (referrerPhone) {
          // Get referrer's balance
          const { data: balanceData } = await supabase
            .from("token_accounts")
            .select("balance")
            .eq("user_id", result.promoter_profile_id)
            .maybeSingle();

          const balance = balanceData?.balance || 0;

          await waSend({
            messaging_product: "whatsapp",
            to: referrerPhone,
            type: "text",
            text: {
              body: `🎉 *You earned 10 tokens!* 🎉\n\n` +
                    `+${phone.slice(-4)} started using easyMO! 🚀\n\n` +
                    `Your new balance: *${balance} TOK* ✨`,
            },
          });
        }
        return true;
      }
    }
  } catch (error) {
    await logStructuredEvent("MOBILITY_REFERRAL_PROCESSING_ERROR", {
      phone: phone.slice(-4), // Mask phone
      error: error instanceof Error ? error.message : String(error),
    }, "error");
  }

  return false;
}

/**
 * Get or create referral code for user
 */
async function getReferralCode(profileId: string): Promise<string> {
  // Check for existing code
  const { data: existing } = await supabase
    .from("referral_links")
    .select("code")
    .eq("user_id", profileId)
    .eq("active", true)
    .maybeSingle();

  if (existing?.code) {
    return existing.code;
  }

  // Generate new code
  try {
    const { data } = await supabase.rpc("generate_referral_code", {
      p_profile_id: profileId,
    });
    if (data && typeof data === "string") {
      return data;
    }
  } catch {
    // Fallback to local generation
  }

  // Local fallback
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }

  // Save to database
  await supabase
    .from("referral_links")
    .upsert({
      user_id: profileId,
      code,
      active: true,
      short_url: `https://easy.mo/r/${code}`,
    }, { onConflict: "user_id" });

  return code;
}

/**
 * Handle Share easyMO button
 */
async function handleShareEasyMO(phone: string, profileId: string | null) {
  if (!profileId) {
    // Try to get profile_id
    const { data: waUser } = await supabase
      .from("whatsapp_users")
      .select("profile_id")
      .eq("phone", phone)
      .maybeSingle();
    
    if (!waUser?.profile_id) {
      await sendWithActionButtons(
        phone,
        `❌ *Error*\n\n` +
        `I couldn't find your profile. Please try again later. 😊`,
      );
      return;
    }
    profileId = waUser.profile_id;
  }

  const code = await getReferralCode(profileId);
  const digits = WA_BOT_NUMBER_E164.replace(/^\+/, "").replace(/\D/g, "");
  const deeplink = `https://wa.me/${digits}?text=${encodeURIComponent(`EASYMO REF ${code}`)}`;

  await sendWithActionButtons(
    phone,
    `🔗 *Share easyMO*\n\n` +
    `Invite your friends! 👥\n\n` +
    `*Your referral link:*\n` +
    `${deeplink}\n\n` +
    `📤 Forward this link to your contacts!\n\n` +
    `When they join, you earn *10 tokens*! 🎉`,
  );
}

async function sendHome(to: string) {
  await waSend({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "🚗 Hey there! 👋" },
      body: { text: "Welcome to easyMO Mobility! 😊\n\nBook or offer rides. Let's go! 🚀" },
      footer: { text: "Professional ride service" },
      action: {
        button: "Let's Go! 🎯",
        sections: [
          {
            title: "What can I help you with?",
            rows: [
              { id: "home_rides", title: "🚗 Find a Ride", description: "Book or offer rides nearby" },
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
      header: { type: "text", text: "🚗 Let's Get You Connected! ✨" },
      body: { text: "Awesome! 😊\n\n*What are you looking for today?*" },
      footer: { text: "Find ride matches nearby" },
      action: {
        button: "Tell Me! 💬",
        sections: [
          {
            title: "What brings you here?",
            rows: [
              { id: "role_driver", title: "🚙 I'm a Driver", description: "I offer rides" },
              { id: "role_passenger", title: "👤 I Need a Ride", description: "I want to book a ride" },
            ],
          },
        ],
      },
    },
  });
}

async function askLocation(to: string, role: "driver" | "passenger") {
  const isDriver = role === "driver";
  const friendlyMessage = isDriver
    ? "🚙 *Perfect! You're a driver!* 🎉\n\n" +
      "Great! Let me find passengers nearby who need a ride! 😊\n\n" +
      "📍 *Quick step:*\n" +
      "Tap 📎 → Location → Send your current location\n\n" +
      "I'll show you potential customers! 🚀"
    : "👤 *Got it! You need a ride!* 🎯\n\n" +
      "Perfect! Let me find available drivers nearby! 😊\n\n" +
      "📍 *Quick step:*\n" +
      "Tap 📎 → Location → Send your current location\n\n" +
      "I'll show you available drivers! 🚗✨";
  
  await sendWithActionButtons(to, friendlyMessage);
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
    const isLookingForDrivers = targetRole === "driver";
    const friendlyMessage = isLookingForDrivers
      ? "😔 *No drivers nearby right now*\n\n" +
        "I couldn't find any drivers in your area. Don't worry! 😊\n\n" +
        "💡 *Try again in a few minutes* - new drivers join all the time! 🚗\n" +
        "Or share your location again to refresh 🔄\n\n" +
        "We'll find you a ride soon! 💪"
      : "😔 *No passengers nearby at the moment*\n\n" +
        "I couldn't find anyone looking for a ride right now. That's okay! 😊\n\n" +
        "💡 *Check back in a few minutes* - customers are always booking rides! 👥\n" +
        "Or share your location again to refresh 🔄\n\n" +
        "Thanks for being part of easyMO! 🙌";
    
    await sendWithActionButtons(to, friendlyMessage);
    return;
  }

  const isLookingForDrivers = targetRole === "driver";
  const friendlyHeader = isLookingForDrivers
    ? "🚗 Found Drivers! 🎉"
    : "👥 Found Passengers! 🎉";
  
  const friendlyBody = isLookingForDrivers
    ? `Great! Found ${rows.length} driver${rows.length > 1 ? "s" : ""} nearby! 😊\n\n` +
      `Sorted by distance - closest first! 👇\n\n` +
      `Tap to connect! 💬`
    : `Awesome! Found ${rows.length} passenger${rows.length > 1 ? "s" : ""} looking for a ride! 😊\n\n` +
      `Sorted by distance - closest first! 👇\n\n` +
      `Tap to see potential customers! 💬`;
  
  await waSend({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: friendlyHeader },
      body: { text: friendlyBody },
      footer: { text: "Sorted by distance ✨" },
      action: { button: "Connect! 💬", sections: [{ title: "Nearby Matches", rows }] },
    },
  });
}

async function sendWaLink(to: string, targetWaId: string) {
  const link = `https://wa.me/${targetWaId}?text=${encodeURIComponent(
    "Hi! I found you via easyMO mobility. Are you available?",
  )}`;
  await sendWithActionButtons(
    to,
    `🎉 *Perfect! Here's your connection!* ✨\n\n` +
    `Tap the link below to start chatting: 😊\n\n` +
    `${link}\n\n` +
    `💬 *Next steps:*\n` +
    `• Tap the link to open chat\n` +
    `• Introduce yourself & confirm details\n` +
    `• Arrange your ride! 🚗\n\n` +
    `Have a safe trip! 🎯✨`,
  );
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

  // Home -> Rides synonyms
  if (["home_rides", "rides", "mobility", "rides_agent", "rides_menu"].includes(id)) return "home_rides";

  // Role synonyms
  if (["role_driver", "driver", "as_driver", "i_am_driver"].includes(id)) return "role_driver";
  if (["role_passenger", "passenger", "as_passenger", "i_am_passenger"].includes(id)) return "role_passenger";

  // Action buttons
  if (id === "share_easymo" || id === "SHARE_EASYMO") return "share_easymo";
  if (id === "home" || id === "HOME") return "home";

  return id;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Health endpoint
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
    const verifyToken = WA_VERIFY_TOKEN ||
      Deno.env.get("WHATSAPP_VERIFY_TOKEN") ||
      "";
    if (mode === "subscribe" && challenge && verifyToken && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("OK", { status: 200 });

  // Basic rate limiting to protect public webhook
  const rateLimit = await rateLimitMiddleware(req, {
    limit: 120,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return rateLimit.response ?? new Response("Too Many Requests", { status: 429 });
  }

  // Read raw body for signature verification + JSON parse
  const rawBody = await req.text();

  // Signature verification (required in prod unless explicitly bypassed)
  const signature = req.headers.get("x-hub-signature-256") ??
    req.headers.get("x-hub-signature") ?? "";
  const runtimeEnv = (Deno.env.get("DENO_ENV") ?? "development").toLowerCase();
  const isProd = runtimeEnv === "production" || runtimeEnv === "prod";
  if (WA_APP_SECRET && signature) {
    const valid = await verifyWebhookSignature(rawBody, signature, WA_APP_SECRET);
    if (!valid && !(ALLOW_UNSIGNED && !isProd)) {
      logStructuredEvent("MOBILITY_SIGNATURE_INVALID", {
        hasSignature: !!signature,
        runtimeEnv,
      }, "warn");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else if (isProd && !ALLOW_UNSIGNED) {
    // In production we expect signatures when app secret is configured
    logStructuredEvent("MOBILITY_SIGNATURE_MISSING", {
      hasSecret: !!WA_APP_SECRET,
      runtimeEnv,
    }, "warn");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { msg, contact } = extractIncoming(body);
  if (!msg?.from) return new Response("OK", { status: 200 });

  const from = String(msg.from);
  const displayName = String(contact?.profile?.name || contact?.name || "");

  // Deduplicate by message id to avoid double processing on retries
  if (msg.id) {
    const claimed = await claimEvent(String(msg.id), from);
    if (!claimed) {
      logStructuredEvent("MOBILITY_DUPLICATE_SKIPPED", { msgId: msg.id });
      return new Response("OK", { status: 200 });
    }
  }

  // CRITICAL: Ensure user exists in whatsapp_users table and has profile
  const { user: waUser, profileId, isNew } = await ensureWhatsAppUser(from, displayName);

  // CRITICAL: If this is a new user and first message contains referral code, process it
  // Only process if we have a profile_id (required for referral system)
  if (isNew && profileId && msg.type === "text" && msg.text?.body) {
    const processed = await processReferralCode(from, msg.text.body, profileId);
    if (processed) {
      await logStructuredEvent("MOBILITY_NEW_USER_REFERRAL", {
        phone: from.slice(-4), // Mask phone
        profileId: profileId,
      });
    }
  }

  // Touch mobility user
  await supabase.rpc("mobility_touch_user", { p_wa_id: from, p_display_name: displayName });

  // TEXT -> only respond to explicit commands or if user is starting fresh
  if (msg.type === "text") {
    const text = String(msg.text?.body || "").trim().toLowerCase();
    const isExplicitCommand = ["home", "menu", "start", "rides", "mobility"].includes(text);
    
    // Get current flow state
    const { data: userState } = await supabase
      .from("mobility_users")
      .select("flow_state")
      .eq("wa_id", from)
      .maybeSingle();
    
    const currentState = userState?.flow_state || "home";
    
    // Only send home menu if:
    // 1. User explicitly typed a command (home, menu, etc.)
    // 2. User is already in "home" state (starting fresh)
    if (isExplicitCommand || currentState === "home") {
      await supabase.from("mobility_users").update({ flow_state: "home" }).eq("wa_id", from);
      await sendHome(from);
    }
    // Otherwise, ignore text messages (user might be chatting with someone else)
    return new Response("OK", { status: 200 });
  }

  // INTERACTIVE selections
  if (msg.type === "interactive" || msg.interactive) {
    const raw = interactiveId(msg);
    const id = normalizeAction(raw);

    // Handle Share easyMO button
    if (id === "share_easymo") {
      await handleShareEasyMO(from, profileId);
      return new Response("OK", { status: 200 });
    }

    // Handle Home button
    if (id === "home") {
      await supabase.from("mobility_users").update({ flow_state: "home" }).eq("wa_id", from);
      await sendHome(from);
      return new Response("OK", { status: 200 });
    }

    if (id === "home_rides") {
      await supabase.from("mobility_users").update({ flow_state: "choose_role" }).eq("wa_id", from);
      await sendRoleMenu(from);
      return new Response("OK", { status: 200 });
    }

    if (id === "role_driver" || id === "role_passenger") {
      const role = id === "role_driver" ? "driver" : "passenger";
      const { error: flowError } = await supabase.rpc("mobility_set_flow", { 
        p_wa_id: from, 
        p_role: role, 
        p_flow_state: "await_location" 
      });
      
      if (flowError) {
        await logStructuredEvent("MOBILITY_SET_FLOW_ERROR", {
          phone: from.slice(-4), // Mask phone
          role: role,
          error: flowError.message || String(flowError),
        }, "error");
      } else {
        await logStructuredEvent("MOBILITY_ROLE_SET", {
          phone: from.slice(-4), // Mask phone
          role: role,
        });
        
        await recordMetric("mobility.role.selected", 1, { role });
      }
      
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
      await sendWithActionButtons(
        from,
        `😅 *Oops! Location Issue*\n\n` +
        `I couldn't read that location. No worries! 😊\n\n` +
        `📍 *Try again:*\n` +
        `Tap 📎 → Location → Send your current location\n\n` +
        `💡 *Tip:* Share your *current* location (live), not a saved place! ✨`,
      );
      return new Response("OK", { status: 200 });
    }

    const { data: me } = await supabase
      .from("mobility_users")
      .select("role_pref")
      .eq("wa_id", from)
      .maybeSingle();

    const rolePref = (me?.role_pref as ("driver" | "passenger" | null)) ?? null;
    if (!rolePref) {
      // User shared location but hasn't selected a role yet
      await sendRoleMenu(from);
      return new Response("OK", { status: 200 });
    }

    // Record presence (this is the explicit search action)
    const { error: presenceError } = await supabase.rpc("mobility_upsert_presence", { 
      p_wa_id: from, 
      p_role: rolePref, 
      p_lat: lat, 
      p_lng: lng 
    });

    if (presenceError) {
      await logStructuredEvent("MOBILITY_PRESENCE_ERROR", {
        phone: from.slice(-4), // Mask phone
        role: rolePref,
        lat: lat,
        lng: lng,
        error: presenceError.message || String(presenceError),
      }, "error");
      
      await recordMetric("mobility.presence.error", 1, { role: rolePref });
      
      await sendWithActionButtons(
        from,
        `😔 *Something Went Wrong*\n\n` +
        `I had trouble saving your location. No worries! 😊\n\n` +
        `Please try sharing your location again! ✨\n\n` +
        `If it keeps happening, let me know! 💪`,
      );
      return new Response("OK", { status: 200 });
    }

    // Log successful presence recording
    await logStructuredEvent("MOBILITY_PRESENCE_RECORDED", {
      phone: from.slice(-4), // Mask phone
      role: rolePref,
      lat: lat,
      lng: lng,
    });
    
    await recordMetric("mobility.presence.recorded", 1, { role: rolePref });

    const targetRole = rolePref === "driver" ? "passenger" : "driver";

    // Search nearby (5km radius first)
    let { data: nearby, error: searchError } = await supabase.rpc("mobility_find_nearby", {
      p_wa_id: from,
      p_target_role: targetRole,
      p_lat: lat,
      p_lng: lng,
      p_limit: 9,
      p_max_km: 5,
      p_ttl_minutes: 30,
    });

    if (searchError) {
      await logStructuredEvent("MOBILITY_SEARCH_ERROR", {
        phone: from.slice(-4), // Mask phone
        targetRole: targetRole,
        radius: 5,
        error: searchError.message || String(searchError),
      }, "error");
      
      await recordMetric("mobility.search.error", 1, { radius: 5 });
    }

    // If no results, try 15km radius
    if (!nearby || nearby.length === 0) {
      ({ data: nearby, error: searchError } = await supabase.rpc("mobility_find_nearby", {
        p_wa_id: from,
        p_target_role: targetRole,
        p_lat: lat,
        p_lng: lng,
        p_limit: 9,
        p_max_km: 15,
        p_ttl_minutes: 30,
      }));
      
      if (searchError) {
        await logStructuredEvent("MOBILITY_SEARCH_ERROR", {
          phone: from.slice(-4), // Mask phone
          targetRole: targetRole,
          radius: 15,
          error: searchError.message || String(searchError),
        }, "error");
        
        await recordMetric("mobility.search.error", 1, { radius: 15 });
      } else {
        await logStructuredEvent("MOBILITY_SEARCH_FALLBACK", {
          phone: from.slice(-4), // Mask phone
          targetRole: targetRole,
          radius: 15,
        });
      }
    }
    
    // Log search results
    if (nearby && nearby.length > 0) {
      await logStructuredEvent("MOBILITY_SEARCH_SUCCESS", {
        phone: from.slice(-4), // Mask phone
        targetRole: targetRole,
        resultCount: nearby.length,
        radius: nearby.length > 0 ? 5 : 15,
      });
      
      await recordMetric("mobility.search.success", 1, {
        resultCount: nearby.length,
        targetRole: targetRole,
      });
    } else {
      await logStructuredEvent("MOBILITY_SEARCH_NO_RESULTS", {
        phone: from.slice(-4), // Mask phone
        targetRole: targetRole,
      });
      
      await recordMetric("mobility.search.no_results", 1, { targetRole });
    }

    // Send results (this will show "no drivers found" if empty, which is correct since user explicitly searched)
    await sendNearbyList(from, targetRole, (nearby || []) as any[]);
    return new Response("OK", { status: 200 });
  }

  // Anything else -> Silent (don't send unsolicited messages)
  // Only respond to explicit user actions (interactive, location, or explicit text commands)
  return new Response("OK", { status: 200 });
});
