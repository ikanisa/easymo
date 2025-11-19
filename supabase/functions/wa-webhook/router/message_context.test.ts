import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { InvalidWhatsAppNumberError } from "../state/store.ts";

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

const contextModule = await import("./message_context.ts");
const {
  buildMessageContext,
  __setMessageContextTestOverrides,
  __resetMessageContextTestOverrides,
} = contextModule;

const dummySupabase = {} as unknown as import("../deps.ts").SupabaseClient;

Deno.test("buildMessageContext resolves profile, state, and locale", async () => {
  let ensureWhatsApp = "";
  let ensureLocale: string | undefined;
  const overrides: Parameters<typeof __setMessageContextTestOverrides>[0] = {
    normalizeWaId: (value: string) => `+${value}`,
    detectMessageLanguage: () => ({
      language: "fr",
      toneLocale: "sw",
      toneDetection: { locale: "sw", swahiliScore: 2, englishScore: 0 },
    }),
    ensureProfile: async (
      _client,
      whatsapp,
      locale,
    ) => {
      ensureWhatsApp = whatsapp;
      ensureLocale = locale;
      return {
        user_id: "user-1",
        whatsapp_e164: "+250700000001",
        locale: "fr",
      };
    },
    getState: async () => ({ key: "home", data: { foo: "bar" } }),
    resolveLanguage: () => "fr",
  };
  __setMessageContextTestOverrides(overrides);
  try {
    const result = await buildMessageContext(
      dummySupabase,
      { id: "wamid.1", from: "250700000001", type: "text" },
      new Map(),
    );
    assertEquals(result?.context.from, "+250700000001");
    assertEquals(result?.context.profileId, "user-1");
    assertEquals(result?.context.locale, "fr");
    assertEquals(result?.context.toneLocale, "sw");
    assertEquals(result?.context.toneDetection, {
      locale: "sw",
      swahiliScore: 2,
      englishScore: 0,
    });
    assertEquals(result?.state, { key: "home", data: { foo: "bar" } });
    assertEquals(result?.language, "fr");
    assertEquals(result?.toneLocale, "sw");
    assertEquals(result?.toneDetection, {
      locale: "sw",
      swahiliScore: 2,
      englishScore: 0,
    });
    assertEquals(ensureWhatsApp, "+250700000001");
    assertEquals(ensureLocale, "fr");
  } finally {
    __resetMessageContextTestOverrides();
  }
});

Deno.test("buildMessageContext skips messages with invalid numbers", async () => {
  let metricCalls = 0;
  __setMessageContextTestOverrides({
    normalizeWaId: (value: string) => `+${value}`,
    detectMessageLanguage: () => ({
      language: null,
      toneLocale: "en",
      toneDetection: { locale: "en", swahiliScore: 0, englishScore: 0 },
    }),
    ensureProfile: async () => {
      throw new InvalidWhatsAppNumberError("bad");
    },
    logMetric: async () => {
      metricCalls += 1;
    },
  });
  try {
    const result = await buildMessageContext(
      dummySupabase,
      { id: "wamid.2", from: "250700000001", type: "text" },
      new Map(),
    );
    assertEquals(result, null);
    assertEquals(metricCalls, 1);
  } finally {
    __resetMessageContextTestOverrides();
  }
});
