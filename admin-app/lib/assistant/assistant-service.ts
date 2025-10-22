import { shouldUseMocks } from "@/lib/runtime-config";
import { mockAssistantRuns } from "@/lib/mock-data";
import { assistantRunSchema } from "@/lib/schemas";
import type { AssistantRun } from "@/lib/schemas";
import { getAdminApiPath } from "@/lib/routes";

export type AssistantRequest = {
  promptId: string;
  input?: string;
};

export type AssistantDecisionPayload = {
  suggestionId: string;
  action: "apply" | "dismiss";
  actionId?: string;
  notes?: string;
};

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestAssistantSuggestion(
  request: AssistantRequest,
): Promise<AssistantRun> {
  const payload = {
    promptId: request.promptId,
    input: request.input ?? null,
  };

  if (!isServer && !useMocks) {
    try {
      const response = await fetch(getAdminApiPath("assistant", "suggestions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const json = await response.json();
        return assistantRunSchema.parse(json);
      }
    } catch (error) {
      console.warn("assistant.fetch_failed", error);
    }
  }

  await delay(350);

  const base =
    mockAssistantRuns.find((run) => run.promptId === request.promptId) ??
      mockAssistantRuns.find((run) => run.promptId === "freeform.query") ??
      mockAssistantRuns[0];

  const stamp = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(-5);
  const clonedSuggestion = {
    ...base.suggestion,
    id: `${base.suggestion.id}-${suffix}`,
    generatedAt: stamp,
  };

  const clonedMessages = base.messages.map((message, idx) => ({
    ...message,
    id: `${message.id}-${suffix}-${idx}`,
    createdAt: stamp,
  }));

  if (request.input && request.promptId === "freeform.query") {
    clonedMessages.push({
      id: `assistant-freeform-echo-${suffix}`,
      role: "assistant",
      content:
        `Captured prompt: “${request.input}”. Replace me with real analysis when the API ships.`,
      createdAt: stamp,
    });
  }

  return {
    promptId: request.promptId,
    suggestion: clonedSuggestion,
    messages: clonedMessages,
  };
}

export async function logAssistantDecision(
  payload: AssistantDecisionPayload,
): Promise<{ status: "ok" }> {
  if (!isServer && !useMocks) {
    try {
      const response = await fetch(getAdminApiPath("audit", "log"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "assistant",
          suggestionId: payload.suggestionId,
          action: payload.action,
          actionId: payload.actionId ?? null,
          notes: payload.notes ?? null,
        }),
      });
      if (response.ok) {
        return { status: "ok" };
      }
    } catch (error) {
      console.warn("assistant.log_failed", error);
    }
  }

  await delay(200);
  console.warn("assistant.log_mock", payload);
  return { status: "ok" };
}
