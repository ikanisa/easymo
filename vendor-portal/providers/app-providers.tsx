"use client";

import { MotionProvider } from "@/providers/motion-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { ConfirmProvider } from "@/providers/confirm-provider";
import { I18nProvider } from "@/providers/i18n-provider";
import { PwaProvider } from "@/providers/pwa-provider";
import { OfflineQueueProvider } from "@/providers/offline-queue-provider";
import { NetworkStatusProvider } from "@/providers/network-status-provider";
import { SupabaseAuthListener } from "@/providers/supabase-auth-listener";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n/locales";
import { Analytics } from "@/src/lib/analytics";
import { AtlasAssistantProvider } from "@/providers/atlas-assistant-provider";

interface AppProvidersProps {
  children: React.ReactNode;
  nonce?: string;
  locale?: SupportedLocale;
  forcedTheme?: "light" | "nyungwe";
}

export function AppProviders({
  children,
  nonce,
  locale = DEFAULT_LOCALE,
  forcedTheme,
}: AppProvidersProps) {
  return (
    <I18nProvider defaultLocale={locale}>
      <ThemeProvider nonce={nonce} forcedTheme={forcedTheme}>
        <ToastProvider>
          <OfflineQueueProvider>
            <NetworkStatusProvider>
              <ConfirmProvider>
                <PwaProvider>
                  <MotionProvider>
                    <AtlasAssistantProvider>
                      <Analytics />
                      <SupabaseAuthListener />
                      {children}
                    </AtlasAssistantProvider>
                  </MotionProvider>
                </PwaProvider>
              </ConfirmProvider>
            </NetworkStatusProvider>
          </OfflineQueueProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
