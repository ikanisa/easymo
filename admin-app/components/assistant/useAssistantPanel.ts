import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  useAssistantDecisionMutation,
  useAssistantSuggestMutation,
} from "@/lib/queries/assistant";
import type {
  AssistantAction,
  AssistantMessage,
  AssistantRun,
  AssistantSuggestion,
} from "@/lib/schemas";
import {
  DEFAULT_LIMITATIONS,
  INTRO_MESSAGE,
  type QuickPrompt,
} from "./constants";

type PromptSource = "prompt" | "freeform";

type RunPromptArgs = {
  promptId: string;
  input?: string;
};

export function useAssistantPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { pushToast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([INTRO_MESSAGE]);
  const [activeSuggestion, setActiveSuggestion] = useState<AssistantSuggestion | null>(
    null,
  );
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { mutateAsync: fetchSuggestion, isPending } = useAssistantSuggestMutation();
  const { mutateAsync: logDecision, isPending: loggingDecision } =
    useAssistantDecisionMutation();

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      transcriptRef.current?.scrollTo({
        top: transcriptRef.current.scrollHeight,
      });
    });
  }, [open, messages.length, activeSuggestion]);

  const isBusy = isPending || loggingDecision;

  const handleClose = useCallback(() => {
    if (isBusy) return;
    onClose();
  }, [isBusy, onClose]);

  const applyRun = useCallback((run: AssistantRun) => {
    setActiveSuggestion(run.suggestion);
    setMessages((prev) => [...prev, ...run.messages]);
  }, []);

  const runPrompt = useCallback(async (payload: RunPromptArgs, source: PromptSource) => {
    const trimmed = payload.input?.trim();
    if (source === "freeform" && !trimmed) return;

    const userMessage: AssistantMessage | null = trimmed
      ? {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      : null;

    if (userMessage) {
      setMessages((prev) => [...prev, userMessage]);
    }

    setActivePrompt(payload.promptId);
    try {
      const result = await fetchSuggestion(payload);
      applyRun(result);
    } catch (error) {
      console.error("assistant.prompt_failed", error);
      pushToast("Assistant is unavailable right now. Try again shortly.", "error");
    } finally {
      setActivePrompt(null);
    }
  }, [applyRun, fetchSuggestion, pushToast]);

  const handlePromptClick = useCallback((prompt: QuickPrompt) => {
    runPrompt({ promptId: prompt.promptId }, "prompt");
  }, [runPrompt]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    runPrompt({ promptId: "freeform.query", input: trimmed }, "freeform");
    setInput("");
  }, [input, runPrompt]);

  const handleApply = useCallback(async (action: AssistantAction) => {
    if (!activeSuggestion) return;
    try {
      await logDecision({
        suggestionId: activeSuggestion.id,
        actionId: action.id,
        action: "apply",
      });
      pushToast("Logged for follow-up. No changes were sent yet.", "success");
    } catch (error) {
      console.error("assistant.apply_failed", error);
      pushToast("Could not log the action. Try again later.", "error");
    }
  }, [activeSuggestion, logDecision, pushToast]);

  const handleDismiss = useCallback(async () => {
    if (!activeSuggestion) return;
    try {
      await logDecision({
        suggestionId: activeSuggestion.id,
        action: "dismiss",
      });
      pushToast("Dismissed suggestion.", "info");
      setActiveSuggestion(null);
    } catch (error) {
      console.error("assistant.dismiss_failed", error);
      pushToast("Unable to record dismissal right now.", "error");
    }
  }, [activeSuggestion, logDecision, pushToast]);

  const handleCopySummary = useCallback(async () => {
    if (!activeSuggestion) return;
    try {
      await navigator.clipboard.writeText(activeSuggestion.summary);
      pushToast("Summary copied to clipboard.", "success");
    } catch (error) {
      console.error("assistant.copy_failed", error);
      pushToast("Copy failed. Select text manually.", "error");
    }
  }, [activeSuggestion, pushToast]);

  const limitationCopy = useMemo(() => {
    if (activeSuggestion?.limitations?.length) {
      return activeSuggestion.limitations;
    }
    return DEFAULT_LIMITATIONS;
  }, [activeSuggestion?.limitations]);

  return {
    input,
    setInput,
    messages,
    activeSuggestion,
    activePrompt,
    transcriptRef,
    isPending,
    loggingDecision,
    isBusy,
    limitationCopy,
    handleClose,
    handlePromptClick,
    handleSubmit,
    handleApply,
    handleDismiss,
    handleCopySummary,
  };
}
