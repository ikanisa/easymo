import { serve } from "./deps.ts";
import { supabase, WA_VERIFY_TOKEN } from "./config.ts";
import { verifySignature } from "./wa/verify.ts";
import { handleMessage } from "./router/router.ts";
import { markEventProcessed } from "./state/idempotency.ts";
import { ensureProfile, getState } from "./state/store.ts";
import { logEvent, logInbound } from "./observe/log.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === WA_VERIFY_TOKEN) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();

  if (!(await verifySignature(req, rawBody))) {
    console.warn("wa_webhook.sig_fail");
    return new Response("sig", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("wa_webhook.bad_json", err);
    return new Response("bad_json", { status: 400 });
  }

  await logInbound(payload);

  const messages = payload?.entry?.flatMap((entry: any) => entry?.changes ?? [])
    .flatMap((change: any) => change?.value?.messages ?? []) ?? [];

  for (const msg of messages) {
    if (!msg?.id) continue;
    const already = await markEventProcessed(msg.id);
    if (already) continue;

    const from = msg.from?.startsWith("+") ? msg.from : `+${msg.from}`;
    const profile = await ensureProfile(supabase, from);
    const state = await getState(supabase, profile.user_id);
    await handleMessage({ supabase, from, profileId: profile.user_id }, msg, state);
  }

  await logEvent("wa-webhook", payload, { statusCode: 200 });

  return new Response("ok", { status: 200 });
});
