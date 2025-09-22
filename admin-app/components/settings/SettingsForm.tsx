'use client';

import { useEffect, useState } from 'react';
import styles from './SettingsForm.module.css';
import { useToast } from '@/components/ui/ToastProvider';
import { IntegrationStatusBadge } from '@/components/ui/IntegrationStatusBadge';

interface SettingsPayload {
  quietHours: string;
  throttlePerMinute: number;
  optOutList: string[];
}

export function SettingsForm() {
  const [form, setForm] = useState<SettingsPayload>({
    quietHours: '22:00 – 06:00',
    throttlePerMinute: 60,
    optOutList: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [integration, setIntegration] = useState<{ target: string; status: 'ok' | 'degraded'; reason?: string; message?: string } | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setForm({
            quietHours: data.quietHours,
            throttlePerMinute: data.throttlePerMinute,
            optOutList: data.optOutList
          });
          setIntegration(data.integration ?? null);
        }
      } catch (error) {
        console.error('Failed to load settings', error);
        pushToast('Unable to load settings; showing defaults.', 'error');
      }
    };
    fetchSettings();
  }, [pushToast]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const parts = form.quietHours.split('–').map((value) => value.trim());
      if (parts.length !== 2 || !/^\d{2}:\d{2}$/.test(parts[0]) || !/^\d{2}:\d{2}$/.test(parts[1])) {
        const text = 'Quiet hours must use format HH:MM – HH:MM.';
        setFeedback(text);
        pushToast(text, 'error');
        setIsSaving(false);
        return;
      }
      const [start, end] = parts;
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quietHours: { start, end },
          throttlePerMinute: form.throttlePerMinute,
          optOutList: form.optOutList
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const text = data?.error ?? 'Failed to save settings.';
        setFeedback(text);
        pushToast(text, 'error');
        setIntegration(data?.integration ?? null);
      } else {
        const text = 'Settings saved.';
        setFeedback(text);
        setForm((prev) => ({ ...prev, quietHours: `${start} – ${end}` }));
        pushToast(text, 'success');
        setIntegration(data?.integration ?? null);
      }
    } catch (error) {
      console.error('Settings update failed', error);
      setFeedback('Unexpected error while saving settings.');
      pushToast('Unexpected error while saving settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSave}>
      <label>
        <span>Quiet hours (start – end)</span>
        <input
          value={form.quietHours}
          onChange={(event) => setForm((prev) => ({ ...prev, quietHours: event.target.value }))}
          placeholder="22:00 – 06:00"
        />
      </label>
      <label>
        <span>WhatsApp throttle per minute</span>
        <input
          type="number"
          min={0}
          value={form.throttlePerMinute}
          onChange={(event) => setForm((prev) => ({ ...prev, throttlePerMinute: Number(event.target.value) }))}
        />
      </label>
      <label>
        <span>Opt-out list (comma separated)</span>
        <input
          value={form.optOutList.join(', ')}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              optOutList: event.target.value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
            }))
          }
          placeholder="+2507..."
        />
      </label>
      <button type="submit" disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save settings'}
      </button>
      {integration ? <IntegrationStatusBadge integration={integration} label="Policy storage" /> : null}
      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}
    </form>
  );
}
