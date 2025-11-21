const handlerRef: { current: ((req: Request) => Promise<Response>) | null } = {
  current: null,
};

const waEvents = new Map<string, { wa_message_id: string }>();
const contacts: Array<Record<string, unknown>> = [];
const logs: Array<{ endpoint: string; payload: unknown }> = [];
const homeMenuItems: Array<Record<string, unknown>> = [
  {
    id: "menu-1",
    key: "jobs",
    name: "Jobs",
    is_active: true,
    active_countries: ["RW"],
    display_order: 1,
    icon: null,
    country_specific_names: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "menu-2",
    key: "schedule_trip",
    name: "Schedule Trip",
    is_active: true,
    active_countries: ["RW"],
    display_order: 2,
    icon: null,
    country_specific_names: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
const profiles = new Map<
  string,
  { user_id: string; whatsapp_e164: string; locale: string | null }
>();
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
      case "whatsapp_home_menu_items":
        return createHomeMenuQuery();
      case "processed_webhook_messages":
        return createIdempotencyMockQuery();
      case "webhook_conversations":
        return createConversationMockQuery();
      case "conversation_state_transitions":
      case "webhook_dlq":
        return createGenericMockQuery();
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  },
  rpc(fn: string) {
    if (fn === "acquire_conversation_lock" || fn === "release_conversation_lock") {
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: [], error: { code: "42883" } });
  },
  auth: {
    admin: {
      createUser: (params: { phone: string }) => {
        return Promise.resolve({
          data: {
            user: {
              id: `user-${params.phone.replace(/\D/g, "")}`,
            },
          },
          error: null,
        });
      },
    },
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

const fetchCalls: Array<{ url: string; payload: unknown }> = [];
globalThis.fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const url = resolveFetchUrl(input);
  const body = await extractJsonBody(input, init);
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

  // Override processor hooks
  const { __setProcessorTestOverrides: setProcessorOverrides } = await import("./router/processor.ts");
  setProcessorOverrides({
    claimEvent: async (id: string) => {
      waEvents.set(id, { wa_message_id: id });
      return true;
    },
    releaseEvent: async (id: string) => {
      waEvents.delete(id);
    },
  });
  
function reset() {
  // Reset state
  waEvents.clear();
  contacts.length = 0;
  logs.length = 0;
  profiles.clear();
  chatState.clear();
  fetchCalls.length = 0;
}

const test = (
  name: string,
  fn: () => Promise<void> | void,
) => Deno.test({ name, sanitizeOps: false, sanitizeResources: false, fn });

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
          locale: typeof record.locale === "string" ? record.locale : null,
        });
      } else if (typeof record.locale === "string") {
        const existing = profiles.get(number)!;
        profiles.set(number, { ...existing, locale: record.locale });
      }
      return this;
    },
    select() {
      return this;
    },
    eq(_column: string, _value: string) {
      return this;
    },
    async single() {
      if (!lastUpsert) throw new Error("profile upsert missing");
      const record = profiles.get(String(lastUpsert.whatsapp_e164));
      return { data: record!, error: null };
    },
    async maybeSingle() {
      // For now, return null to simulate no profile found, triggering creation
      return { data: null, error: null };
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

function createHomeMenuQuery() {
  return {
    select() {
      return this;
    },
    eq(_column: string, _value: unknown) {
      return this;
    },
    contains(_column: string, _values: unknown) {
      return this;
    },
    order() {
      return this;
    },
    async then(resolve: (value: unknown) => void) {
      resolve({ data: homeMenuItems, error: null });
    },
  };
}

function createIdempotencyMockQuery() {
  return {
    select() { return this; },
    eq() { return this; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    insert() { return this; },
  };
}

function createConversationMockQuery() {
  return {
    select() { return this; },
    insert() { return this; },
    update() { return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return this; },
    single() {
      // Return a mock conversation ID
      return Promise.resolve({ data: { id: "conv-mock-123" }, error: null });
    },
    maybeSingle() {
      // Simulate no existing active conversation so we create a new one
      return Promise.resolve({ data: null, error: null });
    },
  };
}

function createGenericMockQuery() {
  return {
    select() { return this; },
    insert() { return this; },
    upsert() { return this; },
    update() { return this; },
    delete() { return this; },
    eq() { return this; },
    neq() { return this; },
    gt() { return this; },
    lt() { return this; },
    gte() { return this; },
    lte() { return this; },
    in() { return this; },
    is() { return this; },
    like() { return this; },
    ilike() { return this; },
    contains() { return this; },
    range() { return this; },
    textSearch() { return this; },
    match() { return this; },
    not() { return this; },
    or() { return this; },
    filter() { return this; },
    order() { return this; },
    limit() { return this; },
    offset() { return this; },
    single() { return Promise.resolve({ data: {}, error: null }); },
    maybeSingle() { return Promise.resolve({ data: {}, error: null }); },
    then(resolve: (value: unknown) => void) {
      resolve({ data: [], error: null });
    },
    rpc() { return Promise.resolve({ data: true, error: null }); },
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

test("rejects POST with invalid signature", async () => {
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

test("processes STOP command and records contact opt-out", async () => {
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
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "250700000000",
                phone_number_id: "12345",
              },
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

test("releases idempotency lock on handler error", async () => {
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
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "250700000000",
                phone_number_id: "12345",
              },
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
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url = resolveFetchUrl(input);
    if (failNext) {
      failNext = false;
      return new Response(JSON.stringify({ error: "fail" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const bodyJson = await extractJsonBody(input, init);
    fetchCalls.push({ url, payload: bodyJson });
    return new Response(
      JSON.stringify({ messages: [{ id: "wamid.SAMPLE" }] }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const response = await handler(
    new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
    }),
  );

  // With enhanced processing, we return 200 and DLQ the error
  assertEquals(response.status, 200);
  assert(response.headers.get("X-Correlation-ID"));
  assertEquals(waEvents.has("wamid.fail.1"), false);
  // restore fetch
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url = resolveFetchUrl(input);
    const bodyJson = await extractJsonBody(input, init);
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

test("renders home menu list on free text and records state", async () => {
  reset();
  const handler = getHandler();
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-2",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "250700000000",
                phone_number_id: "12345",
              },
              messages: [
                {
                  id: "wamid.menu.1",
                  from: "250788000002",
                  type: "text",
                  text: { body: "hello" },
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

  const response = await handler(
    new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
    }),
  );

  assertEquals(response.status, 200);
  assert(fetchCalls.length > 0);
  const lastPayload = fetchCalls[fetchCalls.length - 1]?.payload as any;
  assertEquals(lastPayload?.interactive?.type, "list");
  const rows = lastPayload?.interactive?.action?.sections?.[0]?.rows ?? [];
  assert(rows.length >= 2, "home menu should include dynamic rows");
  const stateEntries = Array.from(chatState.values());
  assert(stateEntries.length > 0, "chat state should be persisted");
  assertEquals((stateEntries[0] as any).state?.key, "home_menu");
});

test("BACK_HOME button returns the home menu list", async () => {
  reset();
  const handler = getHandler();
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-3",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "250700000000",
                phone_number_id: "12345",
              },
              messages: [
                {
                  id: "wamid.back_home.1",
                  from: "250788000003",
                  type: "interactive",
                  interactive: {
                    type: "button",
                    button_reply: { id: "back_home", title: "Home" },
                  },
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

  const response = await handler(
    new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
    }),
  );

  assertEquals(response.status, 200);
  assert(fetchCalls.length > 0);
  const listPayload = fetchCalls[fetchCalls.length - 1]?.payload as any;
  assertEquals(listPayload?.interactive?.type, "list");
  const rows = listPayload?.interactive?.action?.sections?.[0]?.rows ?? [];
  const hasHomeBack = rows.some((row: any) => row.id === "home_more" || row.id === "home_back");
  assert(hasHomeBack, "home navigation rows should be included");
});

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function extractJsonBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<unknown> {
  if (typeof init?.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch {
      return null;
    }
  }
  if (input instanceof Request) {
    const clone = input.clone();
    const text = await clone.text();
    if (text && text.length) {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
  }
  return null;
}
