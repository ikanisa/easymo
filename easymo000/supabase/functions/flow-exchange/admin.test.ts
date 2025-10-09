import { handleAdminAction, setAdminOverrides } from "./admin.ts";
import type {
  FlowExchangeRequest,
  FlowExchangeResponse,
} from "../wa-webhook/types.ts";

const stubSupabase = {} as unknown as import("./types.ts").SupabaseClient;

setAdminOverrides(null);

type LegacyInvocation = {
  request: FlowExchangeRequest;
};

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

Deno.test("bridges payload to legacy handler with resolved wa_id", async () => {
  const calls: LegacyInvocation[] = [];
  const legacyResponse: FlowExchangeResponse = {
    next_screen_id: "s_hub",
    data: { ok: true },
    messages: [{ level: "info", text: "done" }],
  };
  setAdminOverrides({
    legacyHandler: async (req) => {
      calls.push({ request: req });
      return legacyResponse;
    },
  });

  const result = await handleAdminAction(
    {
      flow_id: "flow.admin.hub.v1",
      action_id: "a_admin_load_hub",
      fields: { wa_id: "+250700000001" },
    },
    stubSupabase,
  );

  assertEquals(calls.length, 1);
  const call = calls[0];
  assertEquals(call.request.wa_id, "+250700000001");
  assertEquals(call.request.flow_id, "flow.admin.hub.v1");
  assertEquals(result.next_screen_id, "s_hub");
  assert(result.messages);
  assertEquals(result.messages?.[0].type, "info");
  assertEquals(result.messages?.[0].text, "done");

  setAdminOverrides(null);
});

Deno.test("uses empty string when wa_id missing everywhere", async () => {
  setAdminOverrides({
    legacyHandler: async (req) => ({
      next_screen_id: "s_hub",
      data: { wa: req.wa_id },
    }),
  });

  const result = await handleAdminAction(
    {
      flow_id: "flow.admin.hub.v1",
      action_id: "a_admin_load_hub",
    },
    stubSupabase,
  );

  assertEquals(result.data?.wa, "");
  setAdminOverrides(null);
});

Deno.test("maps field and filter sourced wa_id", async () => {
  setAdminOverrides({
    legacyHandler: async (req) => ({
      next_screen_id: "s_next",
      data: { source: req.wa_id },
    }),
  });

  const result = await handleAdminAction(
    {
      flow_id: "flow.admin.hub.v1",
      action_id: "a_admin_load_hub",
      filters: { wa_id: "+12025550123" },
    },
    stubSupabase,
  );
  assertEquals(result.data?.source, "+12025550123");
  setAdminOverrides(null);
});

Deno.test("converts legacy level messages to type", async () => {
  setAdminOverrides({
    legacyHandler: async () => ({
      next_screen_id: "s_admin_denied",
      messages: [{ level: "error", text: "nope" }],
    }),
  });

  const result = await handleAdminAction(
    {
      flow_id: "flow.admin.hub.v1",
      action_id: "a_admin_load_hub",
    },
    stubSupabase,
  );

  assertEquals(result.messages?.[0].type, "error");
  assertEquals(result.messages?.[0].text, "nope");
  setAdminOverrides(null);
});

Deno.test("passes through page token and field errors", async () => {
  setAdminOverrides({
    legacyHandler: async () => ({
      next_screen_id: "s_next",
      page_token_next: "token",
      field_errors: { pin: "bad" },
    }),
  });

  const result = await handleAdminAction(
    {
      flow_id: "flow.admin.hub.v1",
      action_id: "a_admin_load_hub",
    },
    stubSupabase,
  );

  assertEquals(result.page_token_next, "token");
  assertEquals(result.field_errors?.pin, "bad");
  setAdminOverrides(null);
});
