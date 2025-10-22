"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAdminApiPath } from "@/lib/routes";
import {
  basketsQueryKeys,
  useBasketsSettings,
  type BasketsSettings,
} from "@/lib/queries/baskets";
import styles from "./BasketsSettingsForm.module.css";
import { ReminderLogsCard } from "./ReminderLogsCard";

export function BasketsSettingsForm() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useBasketsSettings();
  const { pushToast } = useToast();
  const [quietHours, setQuietHours] = useState<{ start: string; end: string }>({ start: '22:00', end: '06:00' });
  const [featureFlags, setFeatureFlags] = useState({
    module_enabled: false,
    allocator_enabled: false,
    loans_enabled: false,
  });
  const [templates, setTemplates] = useState<Record<string, string>>({
    reminder_due_in_3: 'tmpl_baskets_due_in_3',
    reminder_due_today: 'tmpl_baskets_due_today',
    reminder_overdue: 'tmpl_baskets_overdue',
  });
  const [reminderThrottle, setReminderThrottle] = useState<number>(30);

  useEffect(() => {
    if (!data) return;
    if (data.quietHours) setQuietHours(data.quietHours);
    if (data.featureFlags) {
      setFeatureFlags((prev) => ({ ...prev, ...data.featureFlags }));
    }
    if (data.templates) setTemplates(data.templates);
    if (typeof data.reminderThrottle === 'number') setReminderThrottle(data.reminderThrottle);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: Partial<BasketsSettings>) => {
      const response = await fetch(getAdminApiPath('baskets', 'settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const res = await response.json().catch(() => null);
        throw new Error(res?.message ?? 'Failed to update settings');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('Settings updated.', 'success');
      await queryClient.invalidateQueries({ queryKey: basketsQueryKeys.settings });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to update settings.', 'error');
    },
  });

  if (isLoading) {
    return <p className={styles.loading}>Loading settings…</p>;
  }

  return (
    <>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({ quietHours, featureFlags, templates, reminderThrottle });
        }}
      >
      <section className={styles.section}>
        <h3>Quiet hours</h3>
        <div className={styles.row}>
          <label>
            <span>Start</span>
            <input
              type="time"
              value={quietHours.start}
              onChange={(event) => setQuietHours((prev) => ({ ...prev, start: event.target.value }))}
            />
          </label>
          <label>
            <span>End</span>
            <input
              type="time"
              value={quietHours.end}
              onChange={(event) => setQuietHours((prev) => ({ ...prev, end: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h3>Feature flags</h3>
        <div className={styles.flags}>
          {(['module_enabled', 'allocator_enabled', 'loans_enabled'] as const).map((flag) => (
            <label key={flag} className={styles.flagItem}>
              <input
                type="checkbox"
                checked={Boolean(featureFlags[flag])}
                onChange={(event) =>
                  setFeatureFlags((prev) => ({ ...prev, [flag]: event.target.checked }))}
              />
              <span>{flag.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3>Reminder templates</h3>
        <div className={styles.row}>
          {Object.entries(templates).map(([key, value]) => (
            <label key={key}>
              <span>{key}</span>
              <input
                value={value}
                onChange={(event) => setTemplates((prev) => ({ ...prev, [key]: event.target.value }))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3>Reminder delivery</h3>
        <div className={styles.row}>
          <label>
            <span>Max reminders per hour</span>
            <input
              type="number"
              min={0}
              max={500}
              value={reminderThrottle}
              onChange={(event) => setReminderThrottle(Number(event.target.value || 0))}
            />
          </label>
        </div>
      </section>

        <Button type="submit" size="sm" disabled={mutation.isLoading}>
          {mutation.isLoading ? 'Saving…' : 'Save settings'}
        </Button>
      </form>

      <ReminderLogsCard />
    </>
  );
}
