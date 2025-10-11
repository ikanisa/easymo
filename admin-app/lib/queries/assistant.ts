import { useMutation } from "@tanstack/react-query";
import type { AssistantRun } from "@/lib/schemas";
import {
  logAssistantDecision,
  requestAssistantSuggestion,
  type AssistantDecisionPayload,
  type AssistantRequest,
} from "@/lib/assistant/assistant-service";

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
