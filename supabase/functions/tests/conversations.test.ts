import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

setupEnv();

function setupEnv() {
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SERVICE_ROLE_KEY", "service-role");
  Deno.env.set("ADMIN_TOKEN", "secret-token");
}

type ConversationRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

type MessageRow = {
  id: number;
  conversation_id: string;
  dir: string;
  body: Record<string, unknown>;
  created_at: string;
};

function createMockSupabaseClient() {
  let conversationCounter = 0;
  let messageCounter = 0;
  const conversations = new Map<string, ConversationRow>();
  const messages: MessageRow[] = [];

  function newConversationId() {
    const suffix = `${++conversationCounter}`.padStart(12, "0");
    return `00000000-0000-0000-0000-${suffix}`;
  }

  function insertConversation(payload: Record<string, unknown>): ConversationRow {
    const row: ConversationRow = {
      id: newConversationId(),
      created_at: new Date().toISOString(),
      metadata: (payload.metadata as Record<string, unknown>) ?? {},
    };
    conversations.set(row.id, row);
    return row;
  }

  function insertMessage(payload: Record<string, unknown>): MessageRow {
    const row: MessageRow = {
      id: ++messageCounter,
      conversation_id: payload.conversation_id as string,
      dir: payload.dir as string,
      body: payload.body as Record<string, unknown>,
      created_at: new Date().toISOString(),
    };
    messages.push(row);
    return row;
  }

  function filterMessages(filters: {
    conversationId?: string;
    id?: number;
    gt?: number;
    lt?: number;
    ascending: boolean;
    limit?: number;
  }): MessageRow[] {
    let rows = messages.filter((msg) =>
      (filters.conversationId === undefined || msg.conversation_id === filters.conversationId) &&
      (filters.id === undefined || msg.id === filters.id) &&
      (filters.gt === undefined || msg.id > filters.gt) &&
      (filters.lt === undefined || msg.id < filters.lt)
    );
    rows = [...rows].sort((a, b) => filters.ascending ? a.id - b.id : b.id - a.id);
    if (filters.limit !== undefined) {
      rows = rows.slice(0, filters.limit);
    }
    return rows;
  }

  const client = {
    conversations,
    messages,
    seedConversation(metadata: Record<string, unknown> = {}) {
      return insertConversation({ metadata }).id;
    },
    seedMessage(conversationId: string, body: Record<string, unknown>) {
      return insertMessage({
        conversation_id: conversationId,
        dir: body.role === "assistant" ? "out" : "in",
        body,
      }).id;
    },
    from(table: string) {
      if (table === "conversations") {
        return {
          insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
            const items = Array.isArray(payload) ? payload : [payload];
            const rows = items.map((item) => insertConversation(item));
            return {
              select() {
                return {
                  single: async () => ({ data: rows[0], error: null }),
                  maybeSingle: async () => ({ data: rows[0], error: null }),
                };
              },
            };
          },
          select() {
            return {
              eq(column: string, value: string) {
                if (column !== "id") throw new Error(`Unexpected column ${column}`);
                const row = conversations.get(value) ?? null;
                return {
                  maybeSingle: async () => ({ data: row, error: null }),
                  single: async () => ({ data: row, error: null }),
                };
              },
            };
          },
          update(values: Record<string, unknown>) {
            return {
              eq(column: string, value: string) {
                if (column !== "id") throw new Error(`Unexpected column ${column}`);
                const row = conversations.get(value) ?? null;
                if (row) {
                  row.metadata = (values.metadata as Record<string, unknown>) ?? row.metadata;
                }
                return {
                  select() {
                    return {
                      maybeSingle: async () => ({ data: row, error: null }),
                    };
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq(column: string, value: string) {
                if (column !== "id") throw new Error(`Unexpected column ${column}`);
                const row = conversations.get(value) ?? null;
                if (row) {
                  conversations.delete(value);
                  for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].conversation_id === value) {
                      messages.splice(i, 1);
                    }
                  }
                }
                return {
                  select() {
                    return {
                      maybeSingle: async () => ({ data: row, error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "messages") {
        return {
          insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
            const items = Array.isArray(payload) ? payload : [payload];
            const rows = items.map((item) => insertMessage(item));
            return {
              select() {
                return {
                  order(_column: string, options: { ascending: boolean }) {
                    const sorted = [...rows].sort((a, b) =>
                      options.ascending ? a.id - b.id : b.id - a.id
                    );
                    return Promise.resolve({ data: sorted, error: null });
                  },
                };
              },
            };
          },
          select() {
            const filters: {
              conversationId?: string;
              id?: number;
              gt?: number;
              lt?: number;
              ascending: boolean;
              limit?: number;
            } = { ascending: true };

            const builder = {
              eq(column: string, value: string | number) {
                if (column === "conversation_id") filters.conversationId = value as string;
                if (column === "id") filters.id = value as number;
                return builder;
              },
              gt(column: string, value: number) {
                if (column === "id") filters.gt = value;
                return builder;
              },
              lt(column: string, value: number) {
                if (column === "id") filters.lt = value;
                return builder;
              },
              order(_column: string, options: { ascending: boolean }) {
                filters.ascending = options.ascending;
                return builder;
              },
              limit(value: number) {
                filters.limit = value;
                return Promise.resolve({ data: filterMessages(filters), error: null });
              },
              maybeSingle() {
                const data = filterMessages(filters);
                return Promise.resolve({ data: data[0] ?? null, error: null });
              },
            };

            return builder;
          },
          delete() {
            const filters: { conversationId?: string; id?: number } = {};
            const builder = {
              eq(column: string, value: string | number) {
                if (column === "conversation_id") filters.conversationId = value as string;
                if (column === "id") filters.id = value as number;
                return builder;
              },
              select() {
                return {
                  maybeSingle: async () => {
                    const index = messages.findIndex((msg) =>
                      (filters.conversationId === undefined || msg.conversation_id === filters.conversationId) &&
                      (filters.id === undefined || msg.id === filters.id)
                    );
                    if (index === -1) return { data: null, error: null };
                    const [removed] = messages.splice(index, 1);
                    return { data: removed, error: null };
                  },
                };
              },
            };
            return builder;
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return client;
}

Deno.test("conversations endpoint requires admin token", async () => {
  const module = await import("../conversations/index.ts");
  const client = createMockSupabaseClient();
  module.setSupabaseClientForTesting(client as any);

  const res = await module.handler(new Request("http://localhost/conversations", { method: "POST" }));
  assertEquals(res.status, 401);
});

Deno.test("conversations endpoint creates conversation with items", async () => {
  const module = await import(`../conversations/index.ts?create=${crypto.randomUUID()}`);
  const client = createMockSupabaseClient();
  module.setSupabaseClientForTesting(client as any);

  const res = await module.handler(
    new Request("http://localhost/conversations", {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
        "x-admin-token": "secret-token",
      }),
      body: JSON.stringify({
        metadata: { topic: "demo" },
        items: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Hello!" }],
          },
        ],
      }),
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.object, "conversation");
  assertEquals(body.metadata.topic, "demo");
  assertEquals(client.conversations.size, 1);
  assertEquals(client.messages.length, 1);
});

Deno.test("conversations endpoint lists items with pagination", async () => {
  const module = await import(`../conversations/index.ts?list=${crypto.randomUUID()}`);
  const client = createMockSupabaseClient();
  const conversationId = client.seedConversation({ topic: "demo" });
  client.seedMessage(conversationId, {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "first" }],
  });
  client.seedMessage(conversationId, {
    type: "message",
    role: "assistant",
    content: [{ type: "input_text", text: "second" }],
  });
  client.seedMessage(conversationId, {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "third" }],
  });

  module.setSupabaseClientForTesting(client as any);

  const res = await module.handler(
    new Request(`http://localhost/conversations/${conversationId}/items?order=asc&limit=2`, {
      method: "GET",
      headers: new Headers({ "x-admin-token": "secret-token" }),
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.object, "list");
  assertEquals(body.data.length, 2);
  assertEquals(
    body.data.map((item: { id: string }) => item.id),
    ["2", "3"],
  );
  assertEquals(body.has_more, true);
});
