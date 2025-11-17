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

  if (!isServer) {
    const response = await fetch(getAdminApiPath("assistant", "suggestions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Assistant suggestions unavailable.");
    }
    const json = await response.json();
    return assistantRunSchema.parse(json);
  }
  throw new Error("Assistant suggestions only available in client environment.");
}

export async function logAssistantDecision(
  payload: AssistantDecisionPayload,
): Promise<{ status: "ok" }> {
  if (!isServer) {
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
    if (!response.ok) {
      throw new Error("Failed to record assistant decision.");
    }
    return { status: "ok" };
  }
  throw new Error("Assistant decision logging only available in client environment.");
}
