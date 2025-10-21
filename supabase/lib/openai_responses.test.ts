import { resolveOpenAiResponseText } from "./openai_responses.ts";

function assertEquals(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
  }
}

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

Deno.test("resolveOpenAiResponseText prefers output_text field", () => {
  const payload = { output_text: "  {\"ok\":true}  " };
  const result = resolveOpenAiResponseText(payload);
  assertEquals(result, "{\"ok\":true}");
});

Deno.test("resolveOpenAiResponseText scans message items", () => {
  const payload = {
    output: [
      { id: "rs_123", type: "reasoning", content: [] },
      {
        id: "msg_123",
        type: "message",
        content: [
          { type: "output_text", text: "{\"value\":42}" },
        ],
      },
    ],
  };
  const result = resolveOpenAiResponseText(payload);
  assertEquals(result, "{\"value\":42}");
});

Deno.test("resolveOpenAiResponseText falls back to choices", () => {
  const payload = {
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "{\"from\":\"choice\"}" },
          ],
        },
      },
    ],
  };
  const result = resolveOpenAiResponseText(payload);
  assertEquals(result, "{\"from\":\"choice\"}");
});

Deno.test("resolveOpenAiResponseText returns null when no text is found", () => {
  const payload = { output: [{ type: "reasoning", content: [] }] };
  const result = resolveOpenAiResponseText(payload);
  assert(result === null);
});
