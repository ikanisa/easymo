import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getAdminApiRoutePath } from "@/lib/routes";

const VOICE_ANALYTICS_KEY = ["voice-analytics"] as const;

const voiceCallSchema = z.object({
  id: z.string(),
  waCallId: z.string().nullable().optional(),
  leadName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: z.string(),
  channel: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  lastNote: z.string().nullable().optional(),
});

const voiceFollowupSchema = z.object({
  id: z.string(),
  callId: z.string().nullable().optional(),
  scheduledAt: z.string(),
  channel: z.string(),
  status: z.string(),
  notes: z.string().nullable().optional(),
});

const voiceStatsSchema = z.object({
  totalCalls: z.number(),
  completed: z.number(),
  failed: z.number(),
  averageDurationSeconds: z.number().nullable().optional(),
  firstTimeToAssistantSeconds: z.number().nullable().optional(),
});

const voiceAnalyticsResponseSchema = z.object({
  calls: z.array(voiceCallSchema),
  followups: z.array(voiceFollowupSchema),
  stats: voiceStatsSchema.nullable().optional(),
});

export type VoiceAnalyticsResponse = z.infer<typeof voiceAnalyticsResponseSchema>;

export async function fetchVoiceAnalytics(
  params?: URLSearchParams,
): Promise<VoiceAnalyticsResponse> {
  const query = params?.toString();
  const response = await fetch(
    `${getAdminApiRoutePath("voiceAnalytics")}${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load voice analytics");
  }

  return voiceAnalyticsResponseSchema.parse(await response.json());
}

const voiceAnalyticsQueryKeys = {
  all: () => VOICE_ANALYTICS_KEY,
  params: (params?: URLSearchParams) => [
    ...VOICE_ANALYTICS_KEY,
    params?.toString() ?? "",
  ] as const,
} as const;

export function useVoiceAnalyticsQuery(params?: URLSearchParams) {
  return useQuery<VoiceAnalyticsResponse>({
    queryKey: voiceAnalyticsQueryKeys.params(params),
    queryFn: () => fetchVoiceAnalytics(params),
    keepPreviousData: true,
  });
}

export { voiceAnalyticsQueryKeys };
