import { assertEquals, assertRejects } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import type { SupabaseClient } from "../deps.ts";

const envReady = (() => {
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service_role_key");
  Deno.env.set("WA_PHONE_ID", "12345");
  Deno.env.set("WA_TOKEN", "token");
  Deno.env.set("WA_APP_SECRET", "super-secret");
  Deno.env.set("WA_VERIFY_TOKEN", "verify-token");
  Deno.env.set("WA_BOT_NUMBER_E164", "+250700000000");
  Deno.env.set("WA_INBOUND_LOG_SAMPLE_RATE", "0");
  Deno.env.set("VOUCHER_SIGNING_SECRET", "voucher-secret");
  return true;
})();

void envReady;

const module = await import("./processor.ts");
const {
  handlePreparedWebhook,
  __setProcessorTestOverrides,
  __resetProcessorTestOverrides,
} = module;

type Metric = { name: string; value: number; tags: Record<string, unknown> };

type StructuredEvent = { event: string; payload: Record<string, unknown> };

type LogEvent = { endpoint: string; payload: Record<string, unknown> };

type ContextResult = {
  context: { supabase: unknown; from: string; locale: string };
  state: { key: string; data?: Record<string, unknown> };
};

function installHooks() {
  const metrics: Metric[] = [];
  const structuredEvents: StructuredEvent[] = [];
  const logEvents: LogEvent[] = [];
  const handled: Array<{ id: string }> = [];
  let retentionRuns = 0;
  const claims: Array<{ id: string; claimed: boolean }> = [];
  const releases: string[] = [];

  __setProcessorTestOverrides({
    claimEvent: async (id: string) => {
      const claimed = id !== "wamid.skip";
      claims.push({ id, claimed });
      return claimed;
    },
    releaseEvent: async (id: string) => {
      releases.push(id);
    },
    buildMessageContext: async (_client, msg) => {
      if (msg.id === "wamid.null") return null;
      const context: ContextResult = {
        context: { supabase: {}, from: msg.from, locale: "en" },
        state: { key: "home" },
      };
      return context;
    },
    handleMessage: async (_ctx, msg) => {
      if (msg.id === "wamid.fail") {
        throw new Error("boom");
      }
      handled.push({ id: msg.id });
    },
    logMetric: async (name, value, tags) => {
      metrics.push({ name, value, tags });
    },
    logStructuredEvent: async (event, payload) => {
      structuredEvents.push({ event, payload });
    },
    logEvent: async (endpoint, payload) => {
      logEvents.push({ endpoint, payload });
    },
    maybeRunRetention: async () => {
      retentionRuns += 1;
    },
  });

  return {
    metrics,
    structuredEvents,
    logEvents,
    handled,
    claims,
    releases,
    getRetentionRuns: () => retentionRuns,
    reset() {
      metrics.length = 0;
      structuredEvents.length = 0;
      logEvents.length = 0;
      handled.length = 0;
      claims.length = 0;
      releases.length = 0;
      retentionRuns = 0;
    },
  };
}

Deno.test("processes claimed messages and skips duplicates", async () => {
  const hooks = installHooks();
  try {
    const prepared: Parameters<typeof handlePreparedWebhook>[1] = {
      type: "messages" as const,
      payload: { object: "whatsapp_business_account", entry: [{}] },
      messages: [
        { id: "wamid.1", from: "250700000001", type: "text" },
        { id: "wamid.skip", from: "250700000002", type: "text" },
        { id: "wamid.null", from: "250700000003", type: "text" },
      ],
      contactLocales: new Map<string, string>(),
      requestStart: Date.now() - 10,
    };

    const response = await handlePreparedWebhook(
      {} as unknown as SupabaseClient,
      prepared,
    );

    assertEquals(response.status, 200);
    assertEquals(hooks.handled.map((entry) => entry.id), ["wamid.1"]);
    assertEquals(hooks.claims, [
      { id: "wamid.1", claimed: true },
      { id: "wamid.skip", claimed: false },
      { id: "wamid.null", claimed: true },
    ]);
    const processedMetric = hooks.metrics.find((m) => m.name === "wa_message_processed");
    assertEquals(processedMetric?.value, 1);
    const latencyEvent = hooks.structuredEvents.find((e) => e.event === "MESSAGE_LATENCY");
    assertEquals(latencyEvent?.payload.message_id, "wamid.1");
    assertEquals(hooks.getRetentionRuns(), 1);
    assertEquals(hooks.logEvents.length, 1);
    assertEquals(hooks.releases.length, 0);
  } finally {
    hooks.reset();
    __resetProcessorTestOverrides();
  }
});

Deno.test("releases idempotency lock and records failure on handler error", async () => {
  const hooks = installHooks();
  try {
    const prepared: Parameters<typeof handlePreparedWebhook>[1] = {
      type: "messages" as const,
      payload: { object: "whatsapp_business_account", entry: [{}] },
      messages: [
        { id: "wamid.fail", from: "250700000010", type: "text" },
      ],
      contactLocales: new Map<string, string>(),
      requestStart: Date.now() - 5,
    };

    await assertRejects(() =>
      handlePreparedWebhook({} as unknown as SupabaseClient, prepared)
    );

    assertEquals(hooks.releases, ["wamid.fail"]);
    const failureMetric = hooks.metrics.find((m) => m.name === "wa_message_failed");
    assertEquals(failureMetric?.value, 1);
    const releaseEvent = hooks.structuredEvents.find((e) => e.event === "IDEMPOTENCY_RELEASE");
    assertEquals(releaseEvent?.payload.message_id, "wamid.fail");
    assertEquals(hooks.logEvents.length, 0);
    assertEquals(hooks.getRetentionRuns(), 0);
  } finally {
    hooks.reset();
    __resetProcessorTestOverrides();
  }
});
