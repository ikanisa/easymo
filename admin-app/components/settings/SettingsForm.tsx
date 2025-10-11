"use client";

import styles from "./SettingsForm.module.css";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { Button } from "@/components/ui/Button";
import { useSettingsForm } from "./useSettingsForm";

export function SettingsForm() {
  const {
    form,
    integration,
    feedback,
    isSaving,
    handlers,
    optOutListInput,
  } = useSettingsForm();

  return (
    <form className={styles.form} onSubmit={handlers.handleSubmit}>
      <label>
        <span>Quiet hours (start – end)</span>
        <input
          value={form.quietHours}
          onChange={(event) => handlers.handleQuietHoursChange(event.target.value)}
          placeholder="22:00 – 06:00"
        />
      </label>
      <label>
        <span>WhatsApp throttle per minute</span>
        <input
          type="number"
          min={0}
          value={form.throttlePerMinute}
          onChange={(event) =>
            handlers.handleThrottleChange(Number(event.target.value))}
        />
      </label>
      <label>
        <span>Opt-out list (comma separated)</span>
        <input
          value={optOutListInput}
          onChange={(event) => handlers.handleOptOutChange(event.target.value)}
          placeholder="+2507..."
        />
      </label>
      <Button type="submit" disabled={isSaving} variant="default">
        {isSaving ? "Saving…" : "Save settings"}
      </Button>
      {integration
        ? (
          <IntegrationStatusBadge
            integration={integration}
            label="Policy storage"
          />
        )
        : null}
      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
    </form>
  );
}
