"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  type ChatCompletionMessage,
  type ChatCompletionResponse,
} from "@/lib/ai/chat-completions";
import { getAdminApiRoutePath } from "@/lib/routes";

interface PlaygroundResponse {
  completion: ChatCompletionResponse;
  request: {
    model: string;
    temperature: number | null;
    maxCompletionTokens: number | null;
    messageCount: number;
  };
  metadata: {
    latencyMs: number;
    requestId: string | null;
    serviceTier: string | null;
    systemFingerprint: string | null;
  };
}

const DEFAULT_SYSTEM_PROMPT =
  "You are an Easymo operations assistant. Provide concise, actionable answers that help operations agents resolve tickets and routing issues.";
const DEFAULT_MODEL = "gpt-4o-mini";

const MODEL_SUGGESTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "o4-mini",
  "o3-mini",
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat().format(value);
}

function roleLabel(role: ChatCompletionMessage["role"]) {
  switch (role) {
    case "system":
      return "System";
    case "assistant":
      return "Assistant";
    case "tool":
      return "Tool";
    case "developer":
      return "Developer";
    default:
      return "User";
  }
}

export function ChatCompletionsPlayground() {
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [temperature, setTemperature] = useState<number>(0.6);
  const [maxCompletionTokens, setMaxCompletionTokens] = useState<string>("");
  const [userInput, setUserInput] = useState<string>("");
  const [turns, setTurns] = useState<ChatCompletionMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);

  const conversationMessages = useMemo(() => {
    return [{ role: "system", content: systemPrompt } as ChatCompletionMessage, ...turns];
  }, [systemPrompt, turns]);

  const pendingUserInput = userInput.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingUserInput || isLoading) {
      return;
    }

    const safeModel = model.trim() || DEFAULT_MODEL;
    const userMessage: ChatCompletionMessage = {
      role: "user",
      content: pendingUserInput,
    };
    const previousTurns = turns;
    const nextTurns = [...turns, userMessage];

    setTurns(nextTurns);
    setUserInput("");
    setIsLoading(true);
    setError(null);

    const maxTokensValue = maxCompletionTokens.trim()
      ? Number(maxCompletionTokens)
      : undefined;

    if (maxTokensValue !== undefined && (Number.isNaN(maxTokensValue) || maxTokensValue <= 0)) {
      setError("Max completion tokens must be a positive number.");
      setIsLoading(false);
      setTurns(previousTurns);
      return;
    }

    const payload = {
      model: safeModel,
      messages: [{ role: "system", content: systemPrompt }, ...nextTurns],
      temperature,
      ...(maxTokensValue ? { maxCompletionTokens: maxTokensValue } : {}),
    };

    try {
      const res = await fetch(getAdminApiRoutePath("openaiChat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as PlaygroundResponse | { error: string; details?: unknown };

      if (!res.ok) {
        console.error("admin.openai_chat.error", data);
        setError(
          typeof data === "object" && data && "error" in data
            ? (data.error as string)
            : "Request failed",
        );
        setTurns(previousTurns);
        return;
      }

      setResponse(data as PlaygroundResponse);
    } catch (err) {
      console.error("admin.openai_chat.unexpected", err);
      setError((err as Error)?.message ?? "Unexpected error");
      setTurns(previousTurns);
    } finally {
      setIsLoading(false);
    }
  }

  function handleResetConversation() {
    setTurns([]);
    setResponse(null);
    setError(null);
  }

  const lastTurn = conversationMessages[conversationMessages.length - 1];
  const usage = response?.completion.usage;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Conversation"
        description="Simulate operations prompts and review OpenAI responses via the Easymo proxy."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetConversation}
            disabled={!turns.length && !response}
          >
            Reset
          </Button>
        }
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 p-4">
            {conversationMessages.map((message, idx) => (
              <div key={idx} className="mb-4 last:mb-0">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                  {idx === 0 ? "System prompt" : roleLabel(message.role)}
                </div>
                <div className="whitespace-pre-wrap text-sm text-[color:var(--color-foreground)]/85">
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3">
            <textarea
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              disabled={isLoading}
              placeholder="Enter the next user message…"
              className="min-h-[120px] rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-3 text-sm text-[color:var(--color-foreground)]/85 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/60"
            />
            {error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : lastTurn?.role === "assistant" ? (
              <p className="text-sm text-[color:var(--color-muted)]">
                Add more user context or reset the conversation to start over.
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isLoading || !pendingUserInput}>
                {isLoading ? "Sending…" : "Send message"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTurns((current) => current.slice(0, -1))}
                disabled={isLoading || turns.length === 0}
              >
                Undo last turn
              </Button>
            </div>
          </form>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
        <div className="space-y-6">
          <SectionCard
            title="Prompt configuration"
            description="Adjust system instructions, model, and advanced sampling options."
          >
            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm text-[color:var(--color-foreground)]/80">
                <span>System prompt</span>
                <textarea
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  className="min-h-[140px] rounded-2xl border border-[color:var(--color-border)]/50 bg-[color:var(--color-surface)]/70 px-4 py-2 text-sm text-[color:var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/60"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-[color:var(--color-foreground)]/80">
                <span>Model</span>
                <div>
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    list="openai-model-suggestions"
                    placeholder="gpt-4o-mini"
                    className="w-full rounded-2xl border border-[color:var(--color-border)]/50 bg-[color:var(--color-surface)]/70 px-4 py-2 text-sm text-[color:var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/60"
                  />
                  <datalist id="openai-model-suggestions">
                    {MODEL_SUGGESTIONS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>
                <span className="text-xs text-[color:var(--color-muted)]">
                  Override with any provisioned model ID. The proxy defaults to {DEFAULT_MODEL} if left blank.
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-[color:var(--color-foreground)]/80">
                  <span>Temperature</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={temperature}
                    onChange={(event) => setTemperature(Number(event.target.value))}
                    className="w-full rounded-2xl border border-[color:var(--color-border)]/50 bg-[color:var(--color-surface)]/70 px-4 py-2 text-sm text-[color:var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/60"
                  />
                  <span className="text-xs text-[color:var(--color-muted)]">
                    Lower values yield more deterministic answers; higher values add creativity.
                  </span>
                </label>

                <label className="flex flex-col gap-2 text-sm text-[color:var(--color-foreground)]/80">
                  <span>Max completion tokens</span>
                  <input
                    type="number"
                    min="0"
                    value={maxCompletionTokens}
                    onChange={(event) => setMaxCompletionTokens(event.target.value)}
                    placeholder="Leave blank for model default"
                    className="w-full rounded-2xl border border-[color:var(--color-border)]/50 bg-[color:var(--color-surface)]/70 px-4 py-2 text-sm text-[color:var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/60"
                  />
                  <span className="text-xs text-[color:var(--color-muted)]">
                    Useful for containing runaway generations during QA runs.
                  </span>
                </label>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Last response"
            description="Inspect token usage, latency, and identifiers to share with the platform team."
            muted
          >
            {response ? (
              <div className="space-y-4 text-sm text-[color:var(--color-foreground)]/85">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Model</dt>
                    <dd>{response.request.model}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Temperature</dt>
                    <dd>{response.request.temperature ?? "default"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Tokens (prompt)</dt>
                    <dd>{formatNumber(usage?.prompt_tokens)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Tokens (completion)</dt>
                    <dd>{formatNumber(usage?.completion_tokens)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Total tokens</dt>
                    <dd>{formatNumber(usage?.total_tokens)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Latency</dt>
                    <dd>{formatNumber(response.metadata.latencyMs)} ms</dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Request ID</dt>
                    <dd className="font-mono text-xs">
                      {response.metadata.requestId ?? "Not returned"}
                    </dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">System fingerprint</dt>
                    <dd className="font-mono text-xs">
                      {response.metadata.systemFingerprint ?? "Not returned"}
                    </dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Service tier</dt>
                    <dd>{response.metadata.serviceTier ?? "auto"}</dd>
                  </div>
                </dl>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Raw JSON</div>
                  <pre className="max-h-64 overflow-auto rounded-2xl border border-[color:var(--color-border)]/40 bg-black/40 p-4 text-xs text-[color:var(--color-foreground)]/90">
                    {JSON.stringify(response.completion, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[color:var(--color-muted)]">
                Send a message to populate usage metrics, latency, and the upstream response payload.
              </p>
            )}
          </SectionCard>
        </div>
        <SectionCard
          title="Turns"
          description="Review each message in the conversation."
        >
          <ol className="space-y-4 text-sm text-[color:var(--color-foreground)]/85">
            {turns.length === 0 ? (
              <li className="text-[color:var(--color-muted)]">No turns yet. Send a message to start the conversation.</li>
            ) : (
              turns.map((turn, index) => (
                <li key={index} className="rounded-xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/70 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                    {roleLabel(turn.role)}
                  </div>
                  <div className="whitespace-pre-wrap">{turn.content}</div>
                </li>
              ))
            )}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
