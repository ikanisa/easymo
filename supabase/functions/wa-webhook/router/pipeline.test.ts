import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";

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

const pipelineModule = await import("./pipeline.ts");
const {
  processWebhookRequest,
  __setPipelineTestOverrides,
  __resetPipelineTestOverrides,
} = pipelineModule;

type StructuredEvent = { event: string; payload: Record<string, unknown> };

function installTestHooks() {
  const events: StructuredEvent[] = [];
  const inbound: unknown[] = [];
  let nextSignatureResult = true;

  __setPipelineTestOverrides({
    logStructuredEvent: async (event: string, payload: Record<string, unknown>) => {
      events.push({ event, payload });
    },
    logInbound: async (payload: unknown) => {
      inbound.push(payload);
    },
    verifySignature: async (_req: Request, _body: string) => nextSignatureResult,
  });

  return {
    events,
    inbound,
    setSignatureResult(value: boolean) {
      nextSignatureResult = value;
    },
    reset() {
      events.length = 0;
      inbound.length = 0;
    },
  };
}

Deno.test("returns hub challenge for verified GET request", async () => {
  const hooks = installTestHooks();
  try {
    const res = await processWebhookRequest(
      new Request(
        "https://example.com/webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=123",
        { method: "GET" },
      ),
    );
    assertEquals(res.type, "response");
    assertEquals(res.response.status, 200);
    assertEquals(await res.response.text(), "123");
    assertEquals(hooks.events.some((entry) => entry.event === "SIG_VERIFY_OK"), true);
  } finally {
    __resetPipelineTestOverrides();
  }
});

Deno.test("rejects POST requests when signature verification fails", async () => {
  const hooks = installTestHooks();
  try {
    hooks.setSignatureResult(false);
    const res = await processWebhookRequest(
      new Request("https://example.com/webhook", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );
    assertEquals(res.type, "response");
    assertEquals(res.response.status, 401);
  } finally {
    __resetPipelineTestOverrides();
  }
});

Deno.test("filters messages for configured phone number and normalises payload", async () => {
  const hooks = installTestHooks();
  try {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: "12345",
                  display_phone_number: "+250 700 000 000",
                },
                contacts: [
                  {
                    wa_id: "250700000001",
                    profile: { locale: "fr" },
                  },
                ],
                messages: [
                  { id: "wamid.1", from: "250700000001", type: "text" },
                  { id: "", from: "250700000002", type: "text" },
                ],
              },
            },
            {
              value: {
                metadata: {
                  phone_number_id: "wrong-id",
                  display_phone_number: "+15550000000",
                },
                messages: [{ id: "wamid.ignored", from: "1555000000", type: "text" }],
              },
            },
          ],
        },
      ],
    };
    const res = await processWebhookRequest(
      new Request("https://example.com/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "content-length": String(JSON.stringify(payload).length),
        },
      }),
    );
    assertEquals(res.type, "messages");
    assertEquals(res.messages.length, 1);
    assertEquals(res.messages[0].id, "wamid.1");
    assertEquals(res.messages[0].from, "250700000001");
    assertEquals(res.contactLocales.get("+250700000001"), "fr");
    assertEquals(res.contactLocales.get("250700000001"), "fr");
  } finally {
    __resetPipelineTestOverrides();
  }
});

Deno.test("deduplicates repeated messages and logs ignored duplicates", async () => {
  const hooks = installTestHooks();
  try {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              value: {
                metadata: {
                  phone_number_id: "12345",
                  display_phone_number: "+250 700 000 000",
                },
                messages: [
                  { id: "wamid.1", from: "250700000001", type: "text" },
                  { id: "wamid.1", from: "250700000001", type: "text" },
                  { id: "wamid.2", from: "250700000001", type: "text" },
                ],
              },
            },
          ],
        },
      ],
    };
    const res = await processWebhookRequest(
      new Request("https://example.com/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "content-type": "application/json",
          "content-length": String(JSON.stringify(payload).length),
        },
      }),
    );
    assertEquals(res.type, "messages");
    assertEquals(res.messages.length, 2);
    const duplicateEvent = hooks.events.find((event) =>
      event.event === "WEBHOOK_DUPLICATE_MESSAGES_IGNORED"
    );
    assertEquals(duplicateEvent, {
      event: "WEBHOOK_DUPLICATE_MESSAGES_IGNORED",
      payload: { duplicates: 1, total: 3 },
    });
  } finally {
    __resetPipelineTestOverrides();
  }
});
