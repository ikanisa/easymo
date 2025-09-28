import { serve } from "./deps.ts";
import { supabase, WA_VERIFY_TOKEN } from "./config.ts";
import { verifySignature } from "./wa/verify.ts";
import { handleMessage } from "./router/router.ts";
import { claimEvent, releaseEvent } from "./state/idempotency.ts";
import { ensureProfile, getState } from "./state/store.ts";
import { logEvent, logInbound, logStructuredEvent } from "./observe/log.ts";

serve(async (req: Request): Promise<Response> => {
  await logStructuredEvent("WEBHOOK_REQUEST_RECEIVED", {
    method: req.method,
    url: req.url,
  });
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === WA_VERIFY_TOKEN
    ) {
      await logStructuredEvent("SIG_VERIFY_OK", { mode: "GET" });
      return new Response(url.searchParams.get("hub.challenge") ?? "", {
        status: 200,
      });
    }
    await logStructuredEvent("SIG_VERIFY_FAIL", { mode: "GET" });
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  await logStructuredEvent("WEBHOOK_BODY_READ", { bytes: rawBody.length });

  if (!(await verifySignature(req, rawBody))) {
    console.warn("wa_webhook.sig_fail");
    await logStructuredEvent("SIG_VERIFY_FAIL", { mode: "POST" });
    return new Response("sig", { status: 401 });
  }
  await logStructuredEvent("SIG_VERIFY_OK", { mode: "POST" });

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("wa_webhook.bad_json", err);
    await logStructuredEvent("WEBHOOK_BODY_PARSE_FAIL", { error: String(err) });
    return new Response("bad_json", { status: 400 });
  }

  await logInbound(payload);

  const messages = payload?.entry?.flatMap((entry: any) => entry?.changes ?? [])
    .flatMap((change: any) => change?.value?.messages ?? []) ?? [];

  if (!messages.length) {
    await logStructuredEvent("WEBHOOK_NO_MESSAGE", {
      payload_type: payload?.object ?? null,
    });
  }

  for (const msg of messages) {
    if (!msg?.id) continue;
    const claimed = await claimEvent(msg.id);
    await logStructuredEvent(claimed ? "IDEMPOTENCY_MISS" : "IDEMPOTENCY_HIT", {
      message_id: msg.id,
    });
    if (!claimed) continue;

    const from = msg.from?.startsWith("+") ? msg.from : `+${msg.from}`;
    const profile = await ensureProfile(supabase, from);
    const state = await getState(supabase, profile.user_id);
    try {
      await handleMessage(
        { supabase, from, profileId: profile.user_id },
        msg,
        state,
      );
    } catch (err) {
      await releaseEvent(msg.id);
      await logStructuredEvent("IDEMPOTENCY_RELEASE", {
        message_id: msg.id,
        reason: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  await logEvent("wa-webhook", payload, { statusCode: 200 });
  await logStructuredEvent("WEBHOOK_RESPONSE", {
    status: 200,
    messageCount: messages.length,
  });

  return new Response("ok", { status: 200 });
});
