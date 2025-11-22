import { useMutation } from "@tanstack/react-query";

import {
  type AssistantDecisionPayload,
  type AssistantRequest,
  logAssistantDecision,
  requestAssistantSuggestion,
} from "@/lib/assistant/assistant-service";
import type { AssistantRun } from "@/lib/schemas";

export function useAssistantSuggestMutation() {
  return useMutation<AssistantRun, unknown, AssistantRequest>({
    mutationKey: ["assistant", "suggest"],
    mutationFn: requestAssistantSuggestion,
  });
}

export function useAssistantDecisionMutation() {
  return useMutation<{ status: "ok" }, unknown, AssistantDecisionPayload>({
    mutationKey: ["assistant", "decision"],
    mutationFn: logAssistantDecision,
  });
}
