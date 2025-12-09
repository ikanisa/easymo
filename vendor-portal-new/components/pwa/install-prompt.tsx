"use client";

import { useCallback, useEffect, useRef } from "react";
import { AddToHomeBanner } from "@/components/system/add-to-home-banner";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptProps {
  open: boolean;
  event: BeforeInstallPromptEvent | null;
  title: string;
  description: string;
  installLabel: string;
  dismissLabel: string;
  onInstalled?: () => void;
  onDismiss: () => void;
}

export function InstallPrompt({
  open,
  event,
  title,
  description,
  installLabel,
  dismissLabel,
  onInstalled,
  onDismiss,
}: InstallPromptProps) {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    deferredPrompt.current = event;
  }, [event]);

  const handleInstall = useCallback(async () => {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) {
      onDismiss();
      return;
    }

    deferredPrompt.current = null;

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        onInstalled?.();
      }
    } finally {
      onDismiss();
    }
  }, [onDismiss, onInstalled]);

  return (
    <AddToHomeBanner
      open={open}
      title={title}
      description={description}
      installLabel={installLabel}
      dismissLabel={dismissLabel}
      onInstall={handleInstall}
      onDismiss={onDismiss}
    />
  );
}
