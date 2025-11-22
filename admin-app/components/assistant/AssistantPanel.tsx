"use client";

import classNames from "classnames";

import { Button } from "@/components/ui/Button";

import styles from "./AssistantPanel.module.css";

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

import { QUICK_PROMPTS } from "./constants";
import { InputForm } from "./panel/InputForm";
import { LimitationsList } from "./panel/LimitationsList";
import { QuickPrompts } from "./panel/QuickPrompts";
import { SuggestionCard } from "./panel/SuggestionCard";
import { Transcript } from "./panel/Transcript";
import { useAssistantPanel } from "./useAssistantPanel";

export function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const {
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
  } = useAssistantPanel({ open, onClose });

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

        <LimitationsList limitations={limitationCopy} />

        <QuickPrompts
          prompts={QUICK_PROMPTS}
          activePrompt={activePrompt}
          disabled={isPending}
          onSelect={handlePromptClick}
        />

        <Transcript
          messages={messages}
          isLoading={isPending}
          containerRef={transcriptRef}
        />

        <SuggestionCard
          suggestion={activeSuggestion}
          isLogging={loggingDecision}
          onApply={handleApply}
          onCopySummary={handleCopySummary}
          onDismiss={handleDismiss}
        />

        <InputForm
          value={input}
          disabled={isPending}
          onChange={(value) => setInput(value)}
          onSubmit={handleSubmit}
        />
      </aside>
    </>
  );
}
