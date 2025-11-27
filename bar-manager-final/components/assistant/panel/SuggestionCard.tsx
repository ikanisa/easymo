import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type {
  AssistantAction,
  AssistantSuggestion,
} from "@/lib/schemas";

import styles from "../AssistantPanel.module.css";

type SuggestionCardProps = {
  suggestion: AssistantSuggestion | null;
  isLogging: boolean;
  onApply: (action: AssistantAction) => void;
  onCopySummary: () => void;
  onDismiss: () => void;
};

export function SuggestionCard({
  suggestion,
  isLogging,
  onApply,
  onCopySummary,
  onDismiss,
}: SuggestionCardProps) {
  if (!suggestion) {
    return (
      <section className={styles.suggestion} aria-live="polite">
        <div className={styles.placeholder}>
          <p>Select a quick prompt or ask a question to see suggestions.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.suggestion} aria-live="polite">
      <div className={styles.suggestionCard}>
        <header>
          <h3>{suggestion.title}</h3>
          <time dateTime={suggestion.generatedAt}>
            Generated {new Date(suggestion.generatedAt).toLocaleTimeString()}
          </time>
        </header>
        <p className={styles.suggestionSummary}>{suggestion.summary}</p>
        <div className={styles.suggestionActions}>
          {suggestion.actions.map((action) => (
            <article key={action.id} className={styles.actionCard}>
              <div>
                <h4>{action.label}</h4>
                <p>{action.summary}</p>
              </div>
              <div className={styles.actionMeta}>
                <span className={styles.actionImpact}>
                  {action.impact} impact
                </span>
                {action.recommended ? <Pill tone="success">Recommended</Pill> : null}
              </div>
              <div className={styles.actionButtons}>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApply(action)}
                  disabled={isLogging}
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
              {suggestion.references.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </div>
          <div className={styles.footerButtons}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopySummary}
              offlineBehavior="allow"
            >
              Copy summary
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={isLogging}
              offlineBehavior="allow"
            >
              Dismiss
            </Button>
          </div>
        </footer>
      </div>
    </section>
  );
}
