import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentRegistry } from "@/lib/queries/agent-orchestration";

describe("useAgentRegistry", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup() {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useAgentRegistry(), { wrapper });
  }

  it("fetches registry data from API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          agents: [
            {
              id: "agent-1",
              agent_type: "driver_negotiation",
              name: "Driver Negotiation",
              enabled: true,
              sla_minutes: 5,
            },
          ],
        }),
    } as Response);

    const { result } = setup();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent-orchestration/registry",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(result.current.data?.agents?.[0]).toMatchObject({
      agent_type: "driver_negotiation",
      enabled: true,
    });
  });
});
