import "../styles/design-tokens.css";
import "../styles/theme.css";
import "../styles/typography.css";
import "../styles/aurora.css";
import "./globals.css";

import { cssVariableSheet } from "@easymo/ui/tokens";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { QueryProvider } from "@/app/providers/QueryProvider";
import { AppProviders } from "@/components/providers/AppProviders";
import { UpdaterInit } from '@/components/system/UpdaterInit';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import { WebVitals } from '@/components/WebVitals';
import { isUiKitEnabled } from "@/lib/ui-kit";

export const metadata: Metadata = {
  title: "easyMO Admin Panel",
  description:
    "Operations console for platform staff — dashboards, automations, and support tools.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const uiV2Enabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false")
    .toLowerCase()
    .trim() === "true";
  const uiKitEnabled = uiV2Enabled || isUiKitEnabled();
  return (
    <html lang="en" className="app-html" data-theme="light" suppressHydrationWarning>
      <body className="app-body" data-ui-theme={uiKitEnabled ? "v2" : undefined} suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider>
            <QueryProvider>
              <ToastProvider>
                <a className="skip-link" href="#main-content">
                  Skip to main content
                </a>
                <AppProviders>
                  <WebVitals />
                  <UpdaterInit />
                  {children}
                </AppProviders>
              </ToastProvider>
            </QueryProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
