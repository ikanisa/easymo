import { QueryKey, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { liveCallSchema } from "@/lib/schemas";
import { getAdminApiPath } from "@/lib/routes";

const LIVE_CALLS_KEY: QueryKey = ["live-calls"];

const liveCallsResponseSchema = z.object({
  calls: z.array(liveCallSchema),
  generatedAt: z.string().datetime().optional(),
  integration: z
    .object({ status: z.string(), message: z.string().optional() })
    .optional(),
});

export type LiveCallsResponse = z.infer<typeof liveCallsResponseSchema> & {
  summary: {
    active: number;
    handoff: number;
    ended: number;
  };
};

export async function fetchLiveCalls(): Promise<LiveCallsResponse> {
  const response = await fetch(getAdminApiPath("live-calls"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load live calls");
  }
  const parsed = liveCallsResponseSchema.parse(await response.json());
  const summary = parsed.calls.reduce(
    (acc, call) => {
      acc[call.status] += 1;
      return acc;
    },
    { active: 0, handoff: 0, ended: 0 } as Record<"active" | "handoff" | "ended", number>,
  );
  return {
    ...parsed,
    summary,
  };
}

export function useLiveCallsQuery() {
  return useQuery({
    queryKey: LIVE_CALLS_KEY,
    queryFn: fetchLiveCalls,
    refetchInterval: 10_000,
  });
}

export const liveCallsQueryKeys = {
  all: () => LIVE_CALLS_KEY,
} as const;
