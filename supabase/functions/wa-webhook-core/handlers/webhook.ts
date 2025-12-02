/**
 * Webhook Verification Handler
 * Handles WhatsApp webhook verification
 */

import { getEnv } from "../../_shared/config/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

/**
 * Handle webhook verification (GET request)
 */
export function handleWebhookVerification(
  req: Request,
  respond: (body: unknown, init?: ResponseInit) => Response
): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const env = getEnv();

  logStructuredEvent("WEBHOOK_VERIFICATION_ATTEMPT", {
    mode,
    hasToken: !!token,
    hasChallenge: !!challenge,
  }, "info");

  if (mode === "subscribe" && token === env.waVerifyToken) {
    logStructuredEvent("WEBHOOK_VERIFICATION_SUCCESS", {
      challenge: challenge?.substring(0, 10) + "...",
    });
    return new Response(challenge, { status: 200 });
  }

  logStructuredEvent("WEBHOOK_VERIFICATION_FAILED", {
    mode,
    tokenMatch: token === env.waVerifyToken,
  }, "warn");

  return respond({ error: "verification_failed" }, { status: 403 });
}
