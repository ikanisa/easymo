import { useCallback, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type ChatState = {
  messages: ChatMessage[];
  previousResponseId?: string;
  isLoading: boolean;
  error?: string | null;
  latencyMs?: number | null;
};

type UseGpt5ChatOptions = {
  endpoint?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  verbosity?: "low" | "medium" | "high";
  maxOutputTokens?: number;
  metadata?: Record<string, string | number | boolean | null>;
  enabled?: boolean;
};

type SendMessageOverrides = Partial<Omit<UseGpt5ChatOptions, "endpoint">> & {
  abortPrevious?: boolean;
  previousResponseId?: string | null;
};

const ENV_GPT5_ENABLED = (process.env.NEXT_PUBLIC_GPT5_ENABLED ?? "false").toLowerCase() === "true";

const DEFAULT_ENDPOINT = "/api/gpt5-chat";

export function useGpt5Chat(options: UseGpt5ChatOptions = {}) {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const defaultReasoning = options.reasoningEffort ?? "low";
  const defaultVerbosity = options.verbosity ?? "medium";
  const defaultMaxTokens = options.maxOutputTokens;
  const defaultMetadata = useMemo(() => options.metadata ?? {}, [options.metadata]);
  const isEnabled = options.enabled ?? ENV_GPT5_ENABLED;

  const abortControllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ChatState>({ messages: [], isLoading: false });

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState({ messages: [], isLoading: false, error: null, latencyMs: null, previousResponseId: undefined });
  }, []);

  const sendMessage = useCallback(
    async (prompt: string, overrides: SendMessageOverrides = {}) => {
      if (!prompt?.trim()) {
        return;
      }

      if (!isEnabled) {
        setState((prev) => ({
          ...prev,
          error: "GPT-5 chat is currently disabled.",
        }));
        return;
      }

      if (overrides.abortPrevious !== false) {
        abortControllerRef.current?.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
      };

      let requestPreviousId: string | undefined;

      setState((prev) => {
        requestPreviousId =
          overrides.previousResponseId ?? prev.previousResponseId ?? undefined;
        return {
          ...prev,
          messages: [...prev.messages, userMessage],
          isLoading: true,
          error: null,
        };
      });

      const bodyPayload = {
        prompt,
        previousResponseId: requestPreviousId,
        reasoningEffort: overrides.reasoningEffort ?? defaultReasoning,
        verbosity: overrides.verbosity ?? defaultVerbosity,
        maxOutputTokens: overrides.maxOutputTokens ?? defaultMaxTokens,
        metadata: { ...defaultMetadata, ...(overrides.metadata ?? {}) },
      };

      const payload = JSON.stringify(bodyPayload);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`GPT-5 request failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          message?: string;
          previousResponseId?: string | null;
          latencyMs?: number | null;
          fallbackModel?: string | null;
        };

        const assistantMessage: ChatMessage = {
          id: data.previousResponseId ?? crypto.randomUUID(),
          role: "assistant",
          content: data.message ?? "",
        };

        setState((prev) => ({
          messages: [...prev.messages, assistantMessage],
          previousResponseId: data.previousResponseId ?? undefined,
          isLoading: false,
          error: null,
          latencyMs: data.latencyMs ?? null,
        }));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unknown GPT-5 failure";

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
    },
    [endpoint, defaultReasoning, defaultVerbosity, defaultMaxTokens, defaultMetadata, isEnabled],
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages: state.messages,
    previousResponseId: state.previousResponseId,
    isLoading: state.isLoading,
    error: state.error ?? null,
    latencyMs: state.latencyMs ?? null,
    sendMessage,
    reset,
    abort,
    enabled: isEnabled,
  };
}

export type { ChatMessage };
