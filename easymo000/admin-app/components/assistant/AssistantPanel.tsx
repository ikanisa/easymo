"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
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
import styles from "./AssistantPanel.module.css";

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

interface QuickPrompt {
  id: string;
  label: string;
  description: string;
  promptId: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "summary-24h",
    label: "Summarize last 24h",
    description: "Highlights key incidents, campaigns, and red flags",
    promptId: "summary.last24h",
  },
  {
    id: "explain-policy",
    label: "Explain policy block",
    description: "Translate opt-out / quiet-hour blocks into next steps",
    promptId: "policy.explainBlock",
  },
  {
    id: "prep-standup",
    label: "Prep stand-up",
    description: "Compile talking points for the ops huddle",
    promptId: "briefing.opsStandup",
  },
];

const INTRO_MESSAGE: AssistantMessage = {
  id: "assistant-intro",
  role: "assistant",
  content:
    "Hey there! I'm your Ops assistant. Pick a prompt or ask a question and I'll pull together context from vouchers, notifications, and logs.",
  createdAt: new Date().toISOString(),
};

export function AssistantPanel({ open, onClose }: AssistantPanelProps) {
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
      transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
    });
  }, [open, messages.length, activeSuggestion]);

  const isBusy = isPending || loggingDecision;

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  const runPrompt = async (
    payload: { promptId: string; input?: string },
    source: "prompt" | "freeform",
  ) => {
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
  };

  const applyRun = (run: AssistantRun) => {
    setActiveSuggestion(run.suggestion);
    setMessages((prev) => [...prev, ...run.messages]);
  };

  const handlePromptClick = (prompt: QuickPrompt) => {
    runPrompt({ promptId: prompt.promptId }, "prompt");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    runPrompt({ promptId: "freeform.query", input: trimmed }, "freeform");
    setInput("");
  };

  const handleApply = async (action: AssistantAction) => {
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
  };

  const handleDismiss = async () => {
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
  };

  const handleCopySummary = async () => {
    if (!activeSuggestion) return;
    try {
      await navigator.clipboard.writeText(activeSuggestion.summary);
      pushToast("Summary copied to clipboard.", "success");
    } catch (error) {
      console.error("assistant.copy_failed", error);
      pushToast("Copy failed. Select text manually.", "error");
    }
  };

  const limitationCopy = useMemo(() => (
    activeSuggestion?.limitations?.length
      ? activeSuggestion.limitations
      : [
        "AI responses may be outdated. Confirm before taking action.",
        "Never share PII or sensitive voucher codes in prompts.",
      ]
  ), [activeSuggestion?.limitations]);

  return (
    <>
      <div
        className={classNames(
          styles.backdrop,
          open ? styles.backdropVisible : null,
        )}
        role="presentation"
        aria-hidden={!open}
        onClick={handleClose}
      />
      <aside
        className={classNames(styles.drawer, open ? styles.open : null)}
        role="complementary"
        aria-label="AI operations assistant"
        aria-hidden={!open}
      >
        <header className={styles.header}>
          <div>
            <h2>Ops assistant</h2>
            <p>Mock suggestions only – nothing is sent to production.</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close assistant"
            onClick={handleClose}
            disabled={isBusy}
            offlineBehavior="allow"
          >
            ×
          </Button>
        </header>

        <div className={styles.limitations} role="note">
          {limitationCopy.map((item, index) => (
            <Pill key={index} tone="warning">{item}</Pill>
          ))}
        </div>

        <section className={styles.quickPrompts}>
          <h3>Quick prompts</h3>
          <ul>
            {QUICK_PROMPTS.map((prompt) => (
              <li key={prompt.id}>
                <button
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  className={classNames(
                    styles.promptButton,
                    activePrompt === prompt.promptId ? styles.promptActive : null,
                  )}
                  disabled={isPending}
                >
                  <span className={styles.promptLabel}>{prompt.label}</span>
                  <span className={styles.promptDescription}>{prompt.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.transcript} ref={transcriptRef} aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              className={classNames(
                styles.message,
                message.role === "assistant"
                  ? styles.messageAssistant
                  : styles.messageUser,
              )}
            >
              <span className={styles.messageBody}>{message.content}</span>
            </div>
          ))}
          {isPending
            ? (
              <div className={classNames(styles.message, styles.messageAssistant)}>
                <span className={styles.messageBody}>Thinking…</span>
              </div>
            )
            : null}
        </section>

        <section className={styles.suggestion} aria-live="polite">
          {activeSuggestion
            ? (
              <div className={styles.suggestionCard}>
                <header>
                  <h3>{activeSuggestion.title}</h3>
                  <time dateTime={activeSuggestion.generatedAt}>
                    Generated {new Date(activeSuggestion.generatedAt).toLocaleTimeString()}
                  </time>
                </header>
                <p className={styles.suggestionSummary}>{activeSuggestion.summary}</p>
                <div className={styles.suggestionActions}>
                  {activeSuggestion.actions.map((action) => (
                    <article key={action.id} className={styles.actionCard}>
                      <div>
                        <h4>{action.label}</h4>
                        <p>{action.summary}</p>
                      </div>
                      <div className={styles.actionMeta}>
                        <span className={styles.actionImpact}>{action.impact} impact</span>
                        {action.recommended
                          ? <Pill tone="success">Recommended</Pill>
                          : null}
                      </div>
                      <div className={styles.actionButtons}>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApply(action)}
                          disabled={loggingDecision}
                        >
                          Apply
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
                <footer className={styles.suggestionFooter}>
                  <div className={styles.referenceList}>
                    <h5>Signals referenced</h5>
                    <ul>
                      {activeSuggestion.references.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.footerButtons}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopySummary}
                      offlineBehavior="allow"
                    >
                      Copy summary
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      disabled={loggingDecision}
                      offlineBehavior="allow"
                    >
                      Dismiss
                    </Button>
                  </div>
                </footer>
              </div>
            )
            : (
              <div className={styles.placeholder}>
                <p>Select a quick prompt or ask a question to see suggestions.</p>
              </div>
            )}
        </section>

        <form className={styles.inputArea} onSubmit={handleSubmit}>
          <label htmlFor="assistant-input" className="visually-hidden">
            Ask the assistant
          </label>
          <textarea
            id="assistant-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask for help…"
            rows={2}
            aria-label="Ask the assistant"
          />
          <div className={styles.inputActions}>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              offlineBehavior="allow"
            >
              Send
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}
