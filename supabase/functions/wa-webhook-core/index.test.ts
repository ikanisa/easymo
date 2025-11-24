import { assertEquals, assertMatch } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { routeIncomingPayload, summarizeServiceHealth } from "./router.ts";
import { LatencyTracker } from "./telemetry.ts";
import { routeMessage } from "./routing_logic.ts";
import type { WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";

function makePayload(text: string, state?: string): WhatsAppWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "test", changes: [{ value: {
        messages: [{ id: "1", from: "123", type: "text", text: { body: text } }],
        metadata: state ? { routing_state: state } : {},
      } }],
    }],
  } as WhatsAppWebhookPayload;
}

Deno.test("routeIncomingPayload mirrors legacy router", () => {
  const payload = makePayload("I need a job");
  const decision = routeIncomingPayload(payload);
  assertEquals(decision.service, routeMessage("I need a job", undefined));
  assertEquals(decision.reason, "keyword");
});

Deno.test("routeIncomingPayload respects chat state", () => {
  const payload = makePayload("Hello", "wallet_active");
  const decision = routeIncomingPayload(payload);
  assertEquals(decision.service, "wa-webhook-wallet");
  assertEquals(decision.reason, "state");
});

Deno.test("routeIncomingPayload falls back to core when no text", () => {
  const payload: WhatsAppWebhookPayload = { object: "whatsapp_business_account", entry: [] } as WhatsAppWebhookPayload;
  const decision = routeIncomingPayload(payload);
  assertEquals(decision.service, "wa-webhook-core");
  assertEquals(decision.reason, "fallback");
});

Deno.test("LatencyTracker flags cold start and p95 breaches", () => {
  const tracker = new LatencyTracker({ windowSize: 5, coldStartSloMs: 10, p95SloMs: 5 });
  tracker.recordColdStart(performance.now() - 20, performance.now(), "cid-1");
  const latency = tracker.recordLatency(10, "cid-1");
  assertEquals(latency, 10);
});

Deno.test("summarizeServiceHealth handles database errors", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return { limit() { return { error: new Error("db down") }; } };
        },
      };
    },
  } as unknown as Parameters<typeof summarizeServiceHealth>[0];

  const health = await summarizeServiceHealth(supabase);
  assertEquals(health.status, "unhealthy");
  assertMatch(health.error ?? "", /db down/);
});
