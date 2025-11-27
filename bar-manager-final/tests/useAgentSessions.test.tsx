import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentSessions } from "@/lib/queries/agent-orchestration";

describe("useAgentSessions", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function render(params?: Parameters<typeof useAgentSessions>[0]) {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const utils = renderHook(() => useAgentSessions(params), { wrapper });
    return { ...utils, client };
  }

  it("builds query params for agent sessions", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [
            {
              id: "session-123",
              status: "searching",
              agent_type: "driver_negotiation",
            },
          ],
          total: 1,
        }),
    } as Response);

    const { result } = render({ status: "searching", limit: 25, offset: 10 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent-orchestration/sessions?status=searching&limit=25&offset=10",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    expect(result.current.data?.sessions).toEqual([
      expect.objectContaining({ id: "session-123", status: "searching" }),
    ]);
  });

  it("omits empty params", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    render();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent-orchestration/sessions?",
      expect.any(Object),
    );
  });
});
