import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

function setBaseEnv() {
  Deno.env.set("SUPABASE_URL", "http://localhost");
  Deno.env.set("SERVICE_ROLE_KEY", "service-role-test");
  Deno.env.set("ADMIN_TOKEN", "super-secret");
}

Deno.test("retrieval-search requires admin auth", async () => {
  setBaseEnv();
  const module = await import("../retrieval-search/index.ts");
  module.setFetchImplementationForTesting(async () => {
    throw new Error("fetch should not be called when unauthorized");
  });

  const res = await module.handler(new Request("http://localhost", { method: "POST" }));
  assertEquals(res.status, 401);
});

Deno.test("retrieval-search validates OpenAI API key", async () => {
  setBaseEnv();
  Deno.env.delete("OPENAI_API_KEY");
  const module = await import("../retrieval-search/index.ts");
  module.setFetchImplementationForTesting(async () => {
    throw new Error("fetch should not run without api key");
  });

  const res = await module.handler(new Request("http://localhost", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "x-admin-token": "super-secret",
    }),
    body: JSON.stringify({ query: "hello" }),
  }));

  assertEquals(res.status, 500);
});

Deno.test("retrieval-search proxies to OpenAI", async () => {
  setBaseEnv();
  Deno.env.set("OPENAI_API_KEY", "sk-test");
  Deno.env.set("OPENAI_RETRIEVAL_VECTOR_STORE_ID", "vs_123");

  const module = await import("../retrieval-search/index.ts");
  module.setFetchImplementationForTesting(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assertEquals(url, "https://api.openai.com/v1/vector_stores/vs_123/search");
    assertEquals(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assertEquals(headers.get("authorization"), "Bearer sk-test");

    const body = JSON.parse(init?.body as string);
    assertEquals(body.query, "hello world");
    assertEquals(body.max_num_results, 5);
    assertEquals(body.rewrite_query, true);

    return new Response(JSON.stringify({
      data: [
        {
          file_id: "file-1",
          filename: "doc.txt",
          score: 0.42,
          content: [{ type: "text", text: "chunk" }],
        },
      ],
      search_query: "hello world",
      usage: { total_tokens: 123 },
      has_more: false,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const res = await module.handler(new Request("http://localhost", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "x-admin-token": "super-secret",
    }),
    body: JSON.stringify({
      query: "hello world",
      maxResults: 5,
      rewriteQuery: true,
    }),
  }));

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ok");
  assertEquals(body.results.length, 1);
  assertEquals(body.query.vector_store_id, "vs_123");
  assertEquals(body.meta.took_ms >= 0, true);
});
