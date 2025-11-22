import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";
import {
  fetchPlatformSettings,
  type PlatformSettingsIntegration,
  savePlatformSettings,
} from "@/lib/settings/platform-settings-service";

export type SettingsFormState = {
  quietHours: string;
  throttlePerMinute: number;
  optOutList: string[];
};

const DEFAULT_STATE: SettingsFormState = {
  quietHours: "22:00 – 06:00",
  throttlePerMinute: 60,
  optOutList: [],
};

function formatQuietHours(
  input: { start: string; end: string } | null | undefined,
) {
  if (!input) return DEFAULT_STATE.quietHours;
  return `${input.start} – ${input.end}`;
}

function parseQuietHours(value: string) {
  const parts = value.split("–").map((segment) => segment.trim());
  if (
    parts.length !== 2 ||
    !/^\d{2}:\d{2}$/.test(parts[0]) ||
    !/^\d{2}:\d{2}$/.test(parts[1])
  ) {
    return null;
  }
  return { start: parts[0]!, end: parts[1]! };
}

export function useSettingsForm() {
  const { pushToast } = useToast();
  const [form, setForm] = useState<SettingsFormState>(DEFAULT_STATE);
  const [integration, setIntegration] =
    useState<PlatformSettingsIntegration | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPlatformSettings();
      setForm({
        quietHours: formatQuietHours(data.quietHours),
        throttlePerMinute: data.throttlePerMinute,
        optOutList: data.optOutList,
      });
      setIntegration(data.integration ?? null);
    } catch (error) {
      console.error("Failed to load settings", error);
      pushToast("Unable to load settings; showing defaults.", "error");
      setIntegration(null);
      setForm(DEFAULT_STATE);
    } finally {
      setIsLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleQuietHoursChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, quietHours: value }));
  }, []);

  const handleThrottleChange = useCallback((value: number) => {
    setForm((prev) => ({ ...prev, throttlePerMinute: value }));
  }, []);

  const handleOptOutChange = useCallback((value: string) => {
    setForm((prev) => ({
      ...prev,
      optOutList: value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSaving(true);
      setFeedback(null);

      const quiet = parseQuietHours(form.quietHours);
      if (!quiet) {
        const message = "Quiet hours must use format HH:MM – HH:MM.";
        setFeedback(message);
        pushToast(message, "error");
        setIsSaving(false);
        return;
      }

      const result = await savePlatformSettings({
        quietHours: quiet,
        throttlePerMinute: form.throttlePerMinute,
        optOutList: form.optOutList,
      });

      setIsSaving(false);
      setIntegration(result.integration ?? null);

      if (!result.ok) {
        setFeedback(result.message);
        pushToast(result.message, "error");
        return;
      }

      const successMessage = result.message ?? "Settings saved.";
      setFeedback(successMessage);
      pushToast(successMessage, "success");
      setForm((prev) => ({
        ...prev,
        quietHours: `${quiet.start} – ${quiet.end}`,
      }));
    },
    [form, pushToast],
  );

  const optOutListInput = useMemo(
    () => form.optOutList.join(", "),
    [form.optOutList],
  );

  return {
    form,
    integration,
    feedback,
    isSaving,
    isLoading,
    handlers: {
      handleSubmit,
      handleQuietHoursChange,
      handleThrottleChange,
      handleOptOutChange,
    },
    optOutListInput,
  };
}
