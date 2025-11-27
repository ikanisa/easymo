import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFlowsListing } from "@/lib/flows/useFlowsListing";
import type { FlowMeta } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";

const useFlowsQuery = vi.fn();
vi.mock("@/lib/queries/flows", () => ({
  useFlowsQuery: (...args: unknown[]) => useFlowsQuery(...args),
}));

const sampleFlows: FlowMeta[] = [
  {
    id: "flow-1",
    title: "Flow One",
    version: "1.0.0",
    status: "draft",
    linkedEndpoints: [],
    lastErrorAt: null,
  },
  {
    id: "flow-2",
    title: "Flow Two",
    version: "1.0.1",
    status: "published",
    linkedEndpoints: ["edge:fn"],
    lastErrorAt: null,
  },
];

describe("useFlowsListing", () => {
  beforeEach(() => {
    useFlowsQuery.mockReset();
  });

  it("provides listing data and handlers", () => {
    const mockResult: PaginatedResult<FlowMeta> = {
      data: sampleFlows,
      total: sampleFlows.length,
      hasMore: true,
    };

    useFlowsQuery.mockReturnValue({
      data: mockResult,
      isLoading: false,
      isFetching: false,
    });

    const { result } = renderHook(() =>
      useFlowsListing({ initialParams: { limit: 50 } }),
    );

    expect(useFlowsQuery).toHaveBeenCalledWith({ limit: 50 });
    expect(result.current.flows).toEqual(sampleFlows);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadingMore).toBe(false);

    act(() => {
      result.current.handleStatusChange("draft");
    });
    expect(useFlowsQuery).toHaveBeenLastCalledWith({
      limit: 50,
      status: "draft",
      offset: 0,
    });

    act(() => {
      result.current.handleLoadMore();
    });
    expect(useFlowsQuery).toHaveBeenLastCalledWith({
      limit: 75,
      status: "draft",
      offset: 0,
    });
  });
});
