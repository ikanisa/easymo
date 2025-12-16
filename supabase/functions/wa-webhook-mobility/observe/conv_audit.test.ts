import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.203.0/testing/asserts.ts";

const envReady = (() => {
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.set("WA_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.set("WA_PHONE_ID", "12345");
  Deno.env.set("WA_TOKEN", "token");
  Deno.env.set("WA_APP_SECRET", "secret");
  Deno.env.set("WA_VERIFY_TOKEN", "verify-token");
  Deno.env.set("WA_BOT_NUMBER_E164", "+250700000000");
  return true;
})();

void envReady;

const { recordInbound } = await import("./conv_audit.ts");

type RouterContext = Parameters<typeof recordInbound>[0];

type InsertRecord = Record<string, unknown>;

function createSupabaseStub() {
  const insertedConversations: InsertRecord[] = [];
  const insertedMessages: InsertRecord[] = [];
  const insertedMetadata: InsertRecord[] = [];

  const supabase = {
    from(table: string) {
      switch (table) {
        case "drivers":
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
              };
            },
          };
        case "conversations":
          return {
            insert(record: InsertRecord) {
              insertedConversations.push(record);
              return {
                select() {
                  return {
                    single: async () => ({
                      data: { id: "conv-1" },
                      error: null,
                    }),
                  };
                },
              };
            },
            select() {
              return {
                eq() {
                  return {
                    order() {
                      return {
                        limit() {
                          return {
                            maybeSingle: async () => ({
                              data: { id: "conv-latest" },
                              error: null,
                            }),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        case "messages":
          return {
            insert(record: InsertRecord) {
              insertedMessages.push(record);
              return {
                select() {
                  return {
                    single: async () => ({
                      data: {
                        id: 42,
                        conversation_id: record.conversation_id ?? null,
                        created_at: "2024-01-01T00:00:00.000Z",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        case "message_metadata":
          return {
            insert(record: InsertRecord) {
              insertedMetadata.push(record);
              return Promise.resolve({ error: null });
            },
          };
        default:
          return {
            select() {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
            insert() {
              return Promise.resolve({ error: null });
            },
          };
      }
    },
  };

  return {
    supabase,
    insertedConversations,
    insertedMessages,
    insertedMetadata,
  };
}

Deno.test("recordInbound stores message metadata snapshot", async () => {
  const stub = createSupabaseStub();
  const ctx: RouterContext = {
    supabase: stub.supabase as unknown as RouterContext["supabase"],
    from: "+250788888888",
    locale: "en",
  };

  const msg = {
    id: "wamid.123",
    from: "250788888888",
    type: "text",
    timestamp: "1700000000",
    text: { body: "Hello" },
    context: { id: "wamid.previous" },
  };

  await recordInbound(ctx, msg);

  assertEquals(stub.insertedMessages.length, 1);
  assertEquals(stub.insertedMetadata.length, 1);

  const metadata = stub.insertedMetadata[0] as Record<string, unknown>;
  assertEquals(metadata.message_id, 42);
  assertEquals(metadata.direction, "inbound");
  assertEquals(metadata.sender_msisdn, "+250788888888");
  assertEquals(metadata.wa_message_id, "wamid.123");
  assertEquals(metadata.message_type, "text");
  assertEquals(metadata.status, "received");
  assertEquals(metadata.recipient_msisdn, "+250700000000");
  assert(metadata.metadata && typeof metadata.metadata === "object");
  const snapshot = metadata.metadata as { text?: { body?: string } };
  assertEquals(snapshot.text?.body, "Hello");
  assert(typeof metadata.sent_at === "string");
});
