import { act, renderHook } from "@testing-library/react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminApiPath } from "@/lib/routes";

import { useGpt5Chat } from "./use-gpt5-chat";

describe("useGpt5Chat", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it("sends a prompt and stores assistant response", async () => {
    const responsePayload = {
      message: "Hello from GPT-5",
      previousResponseId: "resp_123",
      latencyMs: 215,
    };

    const fetchMock = global.fetch as unknown as Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => responsePayload,
    });

    const { result } = renderHook(() => useGpt5Chat({ enabled: true }));

    await act(async () => {
      await result.current.sendMessage("Hi there");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      getAdminApiPath("gpt5-chat"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Hello from GPT-5",
    });
    expect(result.current.previousResponseId).toBe("resp_123");
    expect(result.current.latencyMs).toBe(215);
    expect(result.current.error).toBeNull();
  });

  it("captures API errors and preserves user message", async () => {
    const fetchMock = global.fetch as unknown as Mock;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useGpt5Chat({ enabled: true }));

    await act(async () => {
      await result.current.sendMessage("trigger failure");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({ role: "user" });
    expect(result.current.error).toContain("GPT-5 request failed: 500");
    expect(result.current.isLoading).toBe(false);
  });

  it("does not call the API when GPT-5 is disabled", async () => {
    const { result } = renderHook(() => useGpt5Chat({ enabled: false }));

    await act(async () => {
      await result.current.sendMessage("should not send");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBe("GPT-5 chat is currently disabled.");
  });
});
