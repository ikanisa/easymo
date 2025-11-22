import { act,renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QUICK_PROMPTS } from "@/components/assistant/constants";
import { useAssistantPanel } from "@/components/assistant/useAssistantPanel";
import type { AssistantRun } from "@/lib/schemas";

const pushToast = vi.fn();
const fetchSuggestion = vi.fn<(input: unknown) => Promise<AssistantRun>>();
const logDecision = vi.fn<(input: unknown) => Promise<void>>();

let suggestPending = false;
let decisionPending = false;

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ pushToast }),
}));

vi.mock("react-dom/test-utils", async () => {
  const actual = await vi.importActual<typeof import("react-dom/test-utils")>(
    "react-dom/test-utils",
  );
  const react = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    act: react.act,
  };
});

vi.mock("@/lib/queries/assistant", () => ({
  useAssistantSuggestMutation: () => ({
    mutateAsync: fetchSuggestion,
    get isPending() {
      return suggestPending;
    },
  }),
  useAssistantDecisionMutation: () => ({
    mutateAsync: logDecision,
    get isPending() {
      return decisionPending;
    },
  }),
}));

const sampleRun: AssistantRun = {
  promptId: "summary.last24h",
  suggestion: {
    id: "suggestion-1",
    title: "Daily summary",
    summary: "Summary body",
    generatedAt: new Date().toISOString(),
    actions: [
      {
        id: "action-1",
        label: "Log follow-up",
        summary: "Capture follow-up item",
        impact: "medium",
        recommended: true,
      },
    ],
    references: ["ref-1"],
    limitations: ["Confirm data manually."],
  },
  messages: [
    {
      id: "assistant-msg-1",
      role: "assistant",
      content: "Here is the latest summary.",
      createdAt: new Date().toISOString(),
    },
  ],
};

describe("useAssistantPanel", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    suggestPending = false;
    decisionPending = false;
    fetchSuggestion.mockReset();
    fetchSuggestion.mockResolvedValue(sampleRun);
    logDecision.mockReset();
    logDecision.mockResolvedValue();
    pushToast.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 0;
    });
  });

  afterEach(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
    vi.unstubAllGlobals();
  });

  it("initialises with intro message and no suggestion", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useAssistantPanel({ open: false, onClose })
    );
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.activeSuggestion).toBeNull();
  });

  it("runs a quick prompt and stores the suggestion", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useAssistantPanel({ open: true, onClose })
    );

    await act(async () => {
      result.current.handlePromptClick(QUICK_PROMPTS[0]);
    });

    expect(fetchSuggestion).toHaveBeenCalledWith({
      promptId: QUICK_PROMPTS[0].promptId,
    });
    expect(result.current.activeSuggestion).toEqual(sampleRun.suggestion);
    expect(result.current.messages).toHaveLength(1 + sampleRun.messages.length);
    expect(result.current.activePrompt).toBeNull();
  });

  it("submits freeform input, adds user message, and clears input", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useAssistantPanel({ open: true, onClose })
    );

    act(() => {
      result.current.setInput("  Need help  ");
    });

    await act(async () => {
      const preventDefault = vi.fn();
      result.current.handleSubmit({
        preventDefault,
      } as unknown as FormEvent<HTMLFormElement>);
    });

    expect(fetchSuggestion).toHaveBeenCalledWith({
      promptId: "freeform.query",
      input: "Need help",
    });
    expect(result.current.messages.at(-sampleRun.messages.length - 1)?.role).toBe(
      "user",
    );
    expect(result.current.input).toBe("");
  });

  it("logs decision when applying an action", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useAssistantPanel({ open: true, onClose })
    );

    await act(async () => {
      result.current.handlePromptClick(QUICK_PROMPTS[0]);
    });

    await act(async () => {
      result.current.handleApply(sampleRun.suggestion.actions[0]);
    });

    expect(logDecision).toHaveBeenCalledWith({
      suggestionId: sampleRun.suggestion.id,
      actionId: sampleRun.suggestion.actions[0].id,
      action: "apply",
    });
    expect(pushToast).toHaveBeenCalledWith(
      "Logged for follow-up. No changes were sent yet.",
      "success",
    );
  });

  it("dismisses a suggestion and clears state", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useAssistantPanel({ open: true, onClose })
    );

    await act(async () => {
      result.current.handlePromptClick(QUICK_PROMPTS[0]);
    });

    await act(async () => {
      result.current.handleDismiss();
    });

    expect(logDecision).toHaveBeenCalledWith({
      suggestionId: sampleRun.suggestion.id,
      action: "dismiss",
    });
    expect(result.current.activeSuggestion).toBeNull();
    expect(pushToast).toHaveBeenCalledWith("Dismissed suggestion.", "info");
  });

  it("copies summary to clipboard", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useAssistantPanel({ open: true, onClose })
    );

    await act(async () => {
      result.current.handlePromptClick(QUICK_PROMPTS[0]);
    });

    await act(async () => {
      result.current.handleCopySummary();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      sampleRun.suggestion.summary,
    );
    expect(pushToast).toHaveBeenCalledWith(
      "Summary copied to clipboard.",
      "success",
    );
  });

  it("prevents closing while pending", () => {
    suggestPending = true;
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useAssistantPanel({ open: true, onClose })
    );

    act(() => {
      result.current.handleClose();
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
