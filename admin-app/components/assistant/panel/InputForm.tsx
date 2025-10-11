import { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import styles from "../AssistantPanel.module.css";

type InputFormProps = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function InputForm({
  value,
  disabled,
  onChange,
  onSubmit,
}: InputFormProps) {
  return (
    <form className={styles.inputArea} onSubmit={onSubmit}>
      <label htmlFor="assistant-input" className="visually-hidden">
        Ask the assistant
      </label>
      <textarea
        id="assistant-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask for help…"
        rows={2}
        aria-label="Ask the assistant"
      />
      <div className={styles.inputActions}>
        <Button
          type="submit"
          size="sm"
          disabled={disabled}
          offlineBehavior="allow"
        >
          Send
        </Button>
      </div>
    </form>
  );
}
