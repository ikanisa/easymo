import classNames from "classnames";

import styles from "../AssistantPanel.module.css";
import type { QuickPrompt } from "../constants";

type QuickPromptsProps = {
  prompts: QuickPrompt[];
  activePrompt: string | null;
  disabled: boolean;
  onSelect: (prompt: QuickPrompt) => void;
};

export function QuickPrompts({
  prompts,
  activePrompt,
  disabled,
  onSelect,
}: QuickPromptsProps) {
  return (
    <section className={styles.quickPrompts}>
      <h3>Quick prompts</h3>
      <ul>
        {prompts.map((prompt) => (
          <li key={prompt.id}>
            <button
              type="button"
              onClick={() => onSelect(prompt)}
              className={classNames(
                styles.promptButton,
                activePrompt === prompt.promptId ? styles.promptActive : null,
              )}
              disabled={disabled}
            >
              <span className={styles.promptLabel}>{prompt.label}</span>
              <span className={styles.promptDescription}>
                {prompt.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
