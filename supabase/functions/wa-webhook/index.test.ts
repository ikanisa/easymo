const handlerRef: { current: ((req: Request) => Promise<Response>) | null } = {
  current: null,
};

const waEvents = new Map<string, { wa_message_id: string }>();
const contacts: Array<Record<string, unknown>> = [];
const logs: Array<{ endpoint: string; payload: unknown }> = [];
const profiles = new Map<string, { user_id: string; whatsapp_e164: string }>();
const chatState = new Map<string, { state: unknown }>();

const mockSupabase = {
  from(table: string) {
    switch (table) {
      case "wa_events":
        return createWaEventsQuery();
      case "contacts":
        return createContactsQuery();
      case "profiles":
        return createProfilesQuery();
      case "chat_state":
        return createChatStateQuery();
      case "webhook_logs":
        return createWebhookLogsQuery();
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  },
  rpc(_fn: string) {
    return Promise.resolve({ data: [], error: { code: "42883" } });
  },
};

(globalThis as {
  __WA_WEBHOOK_MOCKS__?: unknown;
}).__WA_WEBHOOK_MOCKS__ = {
  serve(handler: (req: Request) => Promise<Response>) {
    handlerRef.current = handler;
  },
  createClient: () => mockSupabase,
};

const encoder = new TextEncoder();

// Required env vars for config import
Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service_role_key");
Deno.env.set("WA_PHONE_ID", "12345");
Deno.env.set("WA_TOKEN", "token");
Deno.env.set("WA_APP_SECRET", "super-secret");
Deno.env.set("WA_VERIFY_TOKEN", "verify-token");
Deno.env.set("WA_BOT_NUMBER_E164", "+250700000000");
Deno.env.set("WA_INBOUND_LOG_SAMPLE_RATE", "0");
Deno.env.set("VOUCHER_SIGNING_SECRET", "voucher-secret");

const fetchCalls: Array<{ url: string; payload: unknown }> = [];
globalThis.fetch = async (url: string, init?: RequestInit) => {
  const body = typeof init?.body === "string" ? JSON.parse(init!.body) : null;
  fetchCalls.push({ url, payload: body });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.SAMPLE" }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

await import("./index.ts");

if (!handlerRef.current) {
  throw new Error("Webhook handler was not registered");
}

function reset() {
  waEvents.clear();
  contacts.length = 0;
  logs.length = 0;
  profiles.clear();
  chatState.clear();
  fetchCalls.length = 0;
}

function createWaEventsQuery() {
  return {
    upsert(record: { wa_message_id: string }) {
      const exists = waEvents.has(record.wa_message_id);
      if (!exists) {
        waEvents.set(record.wa_message_id, record);
      }
      return {
        select: async () => ({
          data: exists ? [] : [{ wa_message_id: record.wa_message_id }],
          error: null,
        }),
      };
    },
    delete() {
      return {
        eq: async (_column: string, value: string) => {
          waEvents.delete(value);
          return { error: null };
        },
      };
    },
  };
}

function createContactsQuery() {
  return {
    async upsert(record: Record<string, unknown>) {
      contacts.push(record);
      return { error: null };
    },
  };
}

function createProfilesQuery() {
  let lastUpsert: Record<string, unknown> | null = null;
  return {
    upsert(record: Record<string, unknown>) {
      lastUpsert = record;
      const number = String(record.whatsapp_e164);
      if (!profiles.has(number)) {
        profiles.set(number, {
          user_id: `user-${profiles.size + 1}`,
          whatsapp_e164: number,
        });
      }
      return this;
    },
    select() {
      return this;
    },
    async single() {
      if (!lastUpsert) throw new Error("profile upsert missing");
      const record = profiles.get(String(lastUpsert.whatsapp_e164));
      return { data: record!, error: null };
    },
  };
}

function createChatStateQuery() {
  let mode: "select" | "delete" | "upsert" | null = null;
  let userId: string | null = null;
  let statePayload: unknown = null;
  return {
    select() {
      mode = "select";
      return this;
    },
    upsert(record: { user_id: string; state: unknown }) {
      mode = "upsert";
      userId = record.user_id;
      statePayload = record.state;
      return this;
    },
    delete() {
      mode = "delete";
      return this;
    },
    eq(_column: string, value: string) {
      userId = value;
      if (mode === "select") {
        return {
          maybeSingle: async () => {
            const record = chatState.get(value);
            return { data: record ?? null, error: null };
          },
          single: async () => {
            const record = chatState.get(value);
            return { data: record ?? null, error: null };
          },
        };
      }
      if (mode === "upsert" && userId) {
        chatState.set(userId, { state: statePayload });
        return Promise.resolve({ error: null });
      }
      if (mode === "delete" && userId) {
        chatState.delete(userId);
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ error: null });
    },
    async maybeSingle() {
      const record = userId ? chatState.get(userId) : undefined;
      return { data: record ?? null, error: null };
    },
    async single() {
      const record = userId ? chatState.get(userId) : undefined;
      return { data: record ?? null, error: null };
    },
  };
}

function createWebhookLogsQuery() {
  return {
    async insert(record: { endpoint: string; payload: unknown }) {
      logs.push(record);
      return { error: null };
    },
  };
}

async function signPayload(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const bytes = Array.from(new Uint8Array(signature));
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

function getHandler() {
  if (!handlerRef.current) {
    throw new Error("handler missing");
  }
  return handlerRef.current;
}

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return;
  if (actual !== expected) {
    throw new Error(
      message ?? `Assertion failed: ${String(actual)} !== ${String(expected)}`,
    );
  }
}

Deno.test("rejects POST with invalid signature", async () => {
  reset();
  const handler = getHandler();
  const body = JSON.stringify({});
  const res = await handler(
    new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    }),
  );
  assertEquals(res.status, 401);
  assertEquals(waEvents.size, 0);
});

Deno.test("processes STOP command and records contact opt-out", async () => {
  reset();
  const handler = getHandler();
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            value: {
              messages: [
                {
                  id: "wamid.stop.1",
                  from: "250788000000",
                  type: "text",
                  text: { body: "STOP" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(payload);
  const signature = await signPayload("super-secret", body);

  const res = await handler(
    new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
    }),
  );

  assertEquals(res.status, 200);
  assertEquals(fetchCalls.length, 1); // STOP confirmation message
  assertEquals(contacts.length, 1);
  const contact = contacts[0];
  assertEquals(contact.opted_out, true);
  assertEquals(contact.opted_in, false);
  assertEquals(waEvents.has("wamid.stop.1"), true);
});

Deno.test("releases idempotency lock on handler error", async () => {
  reset();
  const handler = getHandler();
  // Force handleMessage to throw by clearing fetch to throw after claim
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            value: {
              messages: [
                {
                  id: "wamid.fail.1",
                  from: "250788000001",
                  type: "text",
                  text: { body: "START" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(payload);
  const signature = await signPayload("super-secret", body);

  // Cause sendText to fail by making fetch return 500 once
  let failNext = true;
  fetchCalls.length = 0;
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    if (failNext) {
      failNext = false;
      return new Response(JSON.stringify({ error: "fail" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const bodyJson = typeof init?.body === "string"
      ? JSON.parse(init.body as string)
      : null;
    fetchCalls.push({ url, payload: bodyJson });
    return new Response(
      JSON.stringify({ messages: [{ id: "wamid.SAMPLE" }] }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  let caught = false;
  try {
    await handler(
      new Request("https://example.com/webhook", {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
        },
      }),
    );
  } catch (_err) {
    caught = true;
  }

  assert(caught, "expected handler to throw");
  assertEquals(waEvents.has("wamid.fail.1"), false);
  // restore fetch
  globalThis.fetch = async (url: string, init?: RequestInit) => {
    const bodyJson = typeof init?.body === "string"
      ? JSON.parse(init.body as string)
      : null;
    fetchCalls.push({ url, payload: bodyJson });
    return new Response(
      JSON.stringify({ messages: [{ id: "wamid.SAMPLE" }] }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };
});
