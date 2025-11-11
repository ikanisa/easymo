import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/theme.css";
import "../styles/typography.css";
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
  children: React.ReactNode;
}) {
  const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false")
    .toLowerCase()
    .trim() === "true";
  return (
    <html lang="en">
      <body data-ui-theme={uiKitEnabled ? "v2" : undefined}>
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
