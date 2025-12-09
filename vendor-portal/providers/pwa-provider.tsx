"use client";

import { useEffect, useState } from "react";
import { InstallPrompt, type BeforeInstallPromptEvent } from "@/components/pwa/install-prompt";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";

interface PwaProviderProps {
  children: React.ReactNode;
}

export function PwaProvider({ children }: PwaProviderProps) {
  const { t } = useTranslation();
  const { success } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/service-worker.js");
        if (!registration) {
          await navigator.serviceWorker.register("/service-worker.js");
        }
      } catch {
        // no-op; registration will be retried on navigation
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setBannerVisible(true);
    };

    const handleAppInstalled = () => {
      setBannerVisible(false);
      setDeferredPrompt(null);
      success(t("toast.genericSuccess"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [success, t]);

  const onDismiss = () => {
    setBannerVisible(false);
    setTimeout(() => setDeferredPrompt(null), 1000);
  };

  return (
    <>
      {children}
      <InstallPrompt
        open={bannerVisible}
        event={deferredPrompt}
        title={t("addToHome.title")}
        description={t("addToHome.description")}
        installLabel={t("addToHome.install")}
        dismissLabel={t("addToHome.dismiss")}
        onInstalled={() => success(t("toast.genericSuccess"))}
        onDismiss={onDismiss}
      />
    </>
  );
}
