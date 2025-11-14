import { assertEquals, assertRejects } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { __resetCache, setCached } from "../utils/cache.ts";

const envReady = (() => {
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service_role_key");
  Deno.env.set("WA_PHONE_ID", "12345");
  Deno.env.set("WA_TOKEN", "token");
  Deno.env.set("WA_APP_SECRET", "super-secret");
  Deno.env.set("WA_VERIFY_TOKEN", "verify-token");
  Deno.env.set("WA_BOT_NUMBER_E164", "+250700000000");
  Deno.env.set("WA_INBOUND_LOG_SAMPLE_RATE", "0");
  return true;
})();

void envReady;

const routerModule = await import("./router.ts");
const {
  handleMessage,
  __setRouterTestOverrides,
  __resetRouterTestOverrides,
  __setRouterEnhancementOverrides,
  __resetRouterEnhancementOverrides,
} = routerModule;

Deno.test("reuses cached route decision for duplicate messages", async () => {
  let textCount = 0;
  __setRouterTestOverrides({
    runGuards: async () => false,
    handleText: async () => {
      textCount += 1;
      return true;
    },
  });
  __setRouterEnhancementOverrides({
    applyRateLimiting: () => ({ allowed: true }),
  });

  const message = { id: "wamid.cache", from: "250788000000", type: "text" } as any;
  const context = { supabase: {}, from: message.from, profileId: "user-1", locale: "en" } as any;
  const state = {} as any;

  await handleMessage(context, message, state);
  assertEquals(textCount, 1);

  // cache correlation id for clarity
  setCached(`wa:webhook:cid:msg:${message.id}`, crypto.randomUUID());

  await handleMessage(context, message, state);
  assertEquals(textCount, 1, "second invocation should hit cache and skip handler");

  __resetRouterTestOverrides();
  __resetRouterEnhancementOverrides();
  __resetCache();
});

Deno.test("throws webhook error when rate limiting blocks message", async () => {
  __setRouterTestOverrides({
    runGuards: async () => false,
    handleText: async () => true,
  });
  __setRouterEnhancementOverrides({
    applyRateLimiting: () => ({
      allowed: false,
      response: new Response("rate_limited", { status: 429 }),
    }),
  });

  const message = { id: "wamid.block", from: "250788000001", type: "text" } as any;
  const context = { supabase: {}, from: message.from, profileId: "user-2", locale: "en" } as any;
  const state = {} as any;

  await assertRejects(
    () => handleMessage(context, message, state),
    Error,
    "Rate limit exceeded",
  );

  __resetRouterTestOverrides();
  __resetRouterEnhancementOverrides();
  __resetCache();
});
