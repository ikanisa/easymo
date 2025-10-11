import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PaginatedResult } from "@/lib/shared/pagination";
import type { TemplateMeta } from "@/lib/schemas";
import { useTemplatesListing } from "@/lib/templates/useTemplatesListing";

const useTemplatesQuery = vi.fn();
vi.mock("@/lib/queries/templates", () => ({
  useTemplatesQuery: (...args: unknown[]) => useTemplatesQuery(...args),
}));

const templates: TemplateMeta[] = [
  {
    id: "template-1",
    name: "Welcome",
    purpose: "Greeting",
    locales: ["en"],
    status: "draft",
    variables: ["name"],
    lastUsedAt: null,
    errorRate: 0,
  },
];

describe("useTemplatesListing", () => {
  beforeEach(() => {
    useTemplatesQuery.mockReset();
  });

  it("wires query params and handlers", () => {
    const mockResult: PaginatedResult<TemplateMeta> = {
      data: templates,
      total: templates.length,
      hasMore: true,
    };

    useTemplatesQuery.mockReturnValue({
      data: mockResult,
      isLoading: false,
      isFetching: false,
    });

    const { result } = renderHook(() =>
      useTemplatesListing({ initialParams: { limit: 100 }, loadStep: 50 }),
    );

    expect(useTemplatesQuery).toHaveBeenCalledWith({ limit: 100 });
    expect(result.current.templates).toEqual(templates);
    expect(result.current.statusFilter).toBe("");

    act(() => {
      result.current.handleStatusChange("approved");
    });
    expect(useTemplatesQuery).toHaveBeenLastCalledWith({
      limit: 100,
      status: "approved",
      offset: 0,
    });

    act(() => {
      result.current.handleLoadMore();
    });
    expect(useTemplatesQuery).toHaveBeenLastCalledWith({
      limit: 150,
      status: "approved",
      offset: 0,
    });
  });
});
