import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "./utils/react-testing";

const subscribeMock = vi.fn();

vi.mock("@/lib/supabase-client", () => ({
  getSupabaseClient: () => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: subscribeMock.mockImplementation((cb?: (status: string) => void) => {
        cb?.("SUBSCRIBED");
        return {
          unsubscribe: vi.fn(),
        } as const;
      }),
      unsubscribe: vi.fn(),
    })),
    from: vi.fn(() => createQueryBuilder()),
  }),
}));

const monitorMock = vi.fn(() => ({ unsubscribe: vi.fn() }));

vi.mock("@/lib/monitoring/realtime", () => ({
  subscribeWithMonitoring: (...args: unknown[]) => monitorMock(...args),
}));

function createQueryBuilder() {
  const response = { data: [], error: null, count: 0 };
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(response)),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return builder;
}

describe("Agents dashboard realtime monitoring", () => {
  beforeEach(() => {
    monitorMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("subscribes to realtime channel with monitoring", async () => {
    const { default: AgentsDashboardPage } = await import(
      "@/app/(panel)/agents/dashboard/page"
    );

    render(<AgentsDashboardPage />);

    await waitFor(() => expect(monitorMock).toHaveBeenCalled());

    expect(monitorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        channel: "agent-dashboard",
        table: "agent_sessions",
        sla: expect.objectContaining({ deadlineField: "deadline_at" }),
      }),
    );

    expect(screen.getByText("AI Agents Dashboard")).toBeInTheDocument();
  });
});
