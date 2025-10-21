import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/testing/asserts.ts";

Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
Deno.env.set("EASYMO_ADMIN_TOKEN", "super-secret");
Deno.env.set("ENABLE_AGENT_CHAT", "true");
Deno.env.set("AGENT_CORE_URL", "https://agent-core.test");
Deno.env.set("AGENT_CORE_TOKEN", "agent-token");

const modulePromise = import("../agent-chat/index.ts");

function createSupabaseStub() {
  const sessions: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [];
  const toolkits: Array<Record<string, unknown>> = [
    {
      agent_kind: "broker",
      model: "gpt-5-preview",
      reasoning_effort: "medium",
      text_verbosity: "medium",
      web_search_enabled: true,
      web_search_allowed_domains: ["example.com"],
      file_search_enabled: false,
      retrieval_enabled: false,
      image_generation_enabled: false,
    },
  ];
  const profiles = [
    { ref_code: "OPS001", user_id: "user-123" },
  ];

  return {
    tables: { sessions, messages, toolkits, profiles },
    client: {
      from(table: string) {
        switch (table) {
          case "profiles":
            return {
              select: () => ({
                eq: (_col: string, value: string) => ({
                  maybeSingle: async () => ({
                    data: profiles.find((p) => p.ref_code === value) ?? null,
                    error: null,
                  }),
                }),
              }),
            };
          case "agent_toolkits":
            return {
              select: () => ({
                eq: (_col: string, value: string) => ({
                  maybeSingle: async () => ({
                    data: toolkits.find((t) => t.agent_kind === value) ?? null,
                    error: null,
                  }),
                }),
              }),
            };
          case "agent_chat_sessions":
            return {
              select: () => ({
                eq: (_col: string, value: string) => ({
                  maybeSingle: async () => ({
                    data: sessions.find((s) => s.id === value) ?? null,
                    error: null,
                  }),
                }),
              }),
              insert: (payload: Record<string, unknown>) => {
                const row = {
                  id: crypto.randomUUID(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  ...payload,
                };
                sessions.push(row);
                return {
                  select: () => ({
                    single: async () => ({ data: row, error: null }),
                  }),
                };
              },
              update: (changes: Record<string, unknown>) => ({
                eq: (_col: string, value: string) => {
                  const row = sessions.find((s) => s.id === value);
                  if (row) Object.assign(row, changes);
                  return Promise.resolve({ data: row ?? null, error: null });
                },
              }),
            };
          case "agent_chat_messages":
            return {
              select: () => ({
                eq: (_col: string, value: string) => ({
                  order: (_field: string, _opts: { ascending: boolean }) => ({
                    limit: (_count: number) => Promise.resolve({
                      data: messages
                        .filter((m) => m.session_id === value)
                        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
                      error: null,
                    }),
                  }),
                }),
              }),
              insert: (payload: Array<Record<string, unknown>>) => {
                const rows = payload.map((item) => ({
                  id: crypto.randomUUID(),
                  created_at: new Date().toISOString(),
                  ...item,
                }));
                messages.push(...rows);
                return {
                  select: () => ({
                    order: (_field: string, _opts: { ascending: boolean }) =>
                      Promise.resolve({ data: rows, error: null }),
                  }),
                };
              },
            };
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      },
    },
  };
}

Deno.test('agent chat uses Agent-Core when available', async () => {
  const { client, tables } = createSupabaseStub();
  const mod = await modulePromise;
  mod.setSupabaseClientForTesting(client as any);

  const fetchStub = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.endsWith('/respond')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          reply: 'LLM answer',
          suggestions: ['Option 1', 'Option 2'],
          citations: [{ id: 1 }],
        })),
      } as Response);
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('not found') } as Response);
  };
  const originalFetch = globalThis.fetch;
  // @ts-ignore - assign stub
  globalThis.fetch = fetchStub as typeof globalThis.fetch;

  try {
    const request = new Request('http://localhost/agent-chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': 'super-secret',
      },
      body: JSON.stringify({
        agent_kind: 'broker',
        message: 'Need vendors',
        profile_ref: 'OPS001',
      }),
    });

    const response = await mod.handler(request);
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.suggestions, ['Option 1', 'Option 2']);
    assertEquals(body.messages.length, 2);
    assertEquals(tables.sessions.length, 1);
    assertEquals(tables.messages.length, 2);
    const agentMessage = tables.messages[1] as { content?: { text?: string } };
    assertMatch(agentMessage.content?.text ?? '', /LLM answer/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('agent chat falls back to stub when Agent-Core unavailable', async () => {
  const { client } = createSupabaseStub();
  const mod = await modulePromise;
  mod.setSupabaseClientForTesting(client as any);

  const originalFetch = globalThis.fetch;
  // @ts-ignore assign stub returning failure
  globalThis.fetch = (() => Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('boom') } as Response)) as typeof globalThis.fetch;

  try {
    const request = new Request('http://localhost/agent-chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': 'super-secret',
      },
      body: JSON.stringify({
        agent_kind: 'support',
        message: 'Help me',
      }),
    });

    const response = await mod.handler(request);
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.messages.length, 2);
    assertMatch(body.messages[1].text, /A teammate will review/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
