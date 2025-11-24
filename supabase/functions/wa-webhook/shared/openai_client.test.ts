import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OpenAIClient } from "./openai_client.ts";

const originalFetch = globalThis.fetch;

globalThis.fetch = async () =>
  new Response(JSON.stringify({ data: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

Deno.test("falls back to zero vector when embedding response is empty", async () => {
  const client = new OpenAIClient("test-key");
  const vector = await client.generateEmbedding("hello world", "text-embedding-3-small", "cid-test");
  assertEquals(Array.isArray(vector), true);
  assertEquals(vector.length, 1536);
  assertEquals(vector.every((v) => v === 0), true);
});

Deno.test("restores fetch after fallback handling", () => {
  globalThis.fetch = originalFetch;
  assertEquals(globalThis.fetch, originalFetch);
});
