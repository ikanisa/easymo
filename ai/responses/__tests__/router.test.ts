import { describe, it, expect, vi, beforeEach } from "vitest";
import { respond, extractTextContent } from "../router";

// Mock OpenAI client
vi.mock("../client", () => ({
  responsesClient: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  RESPONSES_MODEL: "gpt-4o-mini",
  VOUCHER_AGENT_SYSTEM_PROMPT: "You are a test agent",
}));

// Mock tool caller
vi.mock("../../tooling/callTool", () => ({
  callTool: vi.fn(),
}));

describe("Responses Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle simple text responses without tool calls", async () => {
    const { responsesClient } = await import("../client");
    const mockCreate = responsesClient.chat.completions.create as any;

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Hello! How can I help you?",
          },
        },
      ],
    });

    const response = await respond([
      { role: "user", content: "Hello" },
    ]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(response.choices[0].message.content).toBe(
      "Hello! How can I help you?"
    );
  });

  it("should execute tool calls and continue conversation", async () => {
    const { responsesClient } = await import("../client");
    const { callTool } = await import("../../tooling/callTool");
    const mockCreate = responsesClient.chat.completions.create as any;
    const mockCallTool = callTool as any;

    // First call - returns tool call
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_123",
                function: {
                  name: "lookup_customer",
                  arguments: JSON.stringify({ msisdn: "+250788000000" }),
                },
              },
            ],
          },
        },
      ],
    });

    // Mock tool execution
    mockCallTool.mockResolvedValueOnce({
      success: true,
      exists: true,
      name: "John Doe",
      msisdn: "+250788000000",
    });

    // Second call - final response
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "I found the customer: John Doe",
          },
        },
      ],
    });

    const response = await respond([
      { role: "user", content: "Look up customer +250788000000" },
    ]);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCallTool).toHaveBeenCalledWith(
      "lookup_customer",
      { msisdn: "+250788000000" },
      expect.any(Object)
    );
    expect(extractTextContent(response)).toBe("I found the customer: John Doe");
  });

  it("should include system prompt if not provided", async () => {
    const { responsesClient } = await import("../client");
    const mockCreate = responsesClient.chat.completions.create as any;

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Response",
          },
        },
      ],
    });

    await respond([{ role: "user", content: "Test" }]);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].role).toBe("system");
  });

  it("should handle tool execution errors gracefully", async () => {
    const { responsesClient } = await import("../client");
    const { callTool } = await import("../../tooling/callTool");
    const mockCreate = responsesClient.chat.completions.create as any;
    const mockCallTool = callTool as any;

    // First call - returns tool call
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_456",
                function: {
                  name: "create_voucher",
                  arguments: JSON.stringify({
                    customer_msisdn: "+250788000000",
                    amount: 100,
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    // Mock tool error
    mockCallTool.mockRejectedValueOnce(new Error("Database connection failed"));

    // Second call - handle error
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Sorry, there was an error creating the voucher",
          },
        },
      ],
    });

    const response = await respond([
      { role: "user", content: "Create a voucher" },
    ]);

    expect(mockCallTool).toHaveBeenCalled();
    expect(response).toBeDefined();
  });
});

describe("extractTextContent", () => {
  it("should extract content from completion", () => {
    const completion = {
      choices: [
        {
          message: {
            role: "assistant" as const,
            content: "Test content",
          },
        },
      ],
    } as any;

    expect(extractTextContent(completion)).toBe("Test content");
  });

  it("should return empty string if no content", () => {
    const completion = {
      choices: [
        {
          message: {
            role: "assistant" as const,
            content: null,
          },
        },
      ],
    } as any;

    expect(extractTextContent(completion)).toBe("");
  });
});
