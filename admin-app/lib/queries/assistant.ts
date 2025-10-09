import { useMutation } from "@tanstack/react-query";
import {
  logAssistantDecision,
  requestAssistantSuggestion,
  type AssistantDecisionPayload,
  type AssistantRequest,
} from "@/lib/data-provider";
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
