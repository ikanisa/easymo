import classNames from "classnames";
import { type RefObject } from "react";
import type { AssistantMessage } from "@/lib/schemas";
import styles from "../AssistantPanel.module.css";

type TranscriptProps = {
  messages: AssistantMessage[];
  isLoading: boolean;
  containerRef: RefObject<HTMLDivElement>;
};

export function Transcript({
  messages,
  isLoading,
  containerRef,
}: TranscriptProps) {
  return (
    <section
      className={styles.transcript}
      ref={containerRef}
      aria-live="polite"
    >
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
      {isLoading
        ? (
          <div className={classNames(styles.message, styles.messageAssistant)}>
            <span className={styles.messageBody}>Thinking…</span>
          </div>
        )
        : null}
    </section>
  );
}
