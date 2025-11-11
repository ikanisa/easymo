import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const openAiMocks = vi.hoisted(() => ({
  getOpenAIClient: vi.fn(),
}));

vi.mock("@/lib/server/openai", () => ({
  getOpenAIClient: openAiMocks.getOpenAIClient,
  resetOpenAIClient: vi.fn(),
}));

describe("POST /api/gpt5-chat", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    openAiMocks.getOpenAIClient.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 503 when OpenAI client is unavailable", async () => {
    openAiMocks.getOpenAIClient.mockReturnValue(null);

    const request = new Request("http://test.local/api/gpt5-chat", {
      method: "POST",
      body: JSON.stringify({ prompt: "hi" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toBe("openai_not_configured");
  });

  it("validates incoming payloads", async () => {
    openAiMocks.getOpenAIClient.mockReturnValue({ responses: { create: vi.fn() } });

    const request = new Request("http://test.local/api/gpt5-chat", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("invalid_payload");
  });

  it("forwards prompts to OpenAI and returns the assistant message", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "resp_456",
      output_text: "Processed",
      usage: { output_tokens: 42 },
    });

    openAiMocks.getOpenAIClient.mockReturnValue({ responses: { create } });

    const request = new Request("http://test.local/api/gpt5-chat", {
      method: "POST",
      body: JSON.stringify({ prompt: "hello", reasoningEffort: "low" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(create).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      message: "Processed",
      previousResponseId: "resp_456",
      usage: { output_tokens: 42 },
    });
  });
});
