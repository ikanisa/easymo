import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/design-tokens.css";
import "../styles/theme.css";
import "../styles/typography.css";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { cssVariableSheet } from "@easymo/ui/tokens";
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
    <html lang="en" className="app-html" suppressHydrationWarning>
      <body className="app-body" data-ui-theme={uiKitEnabled ? "v2" : undefined} suppressHydrationWarning>
        <QueryProvider>
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>
          <AppProviders>{children}</AppProviders>
        </QueryProvider>
      </body>
    </html>
  );
}
