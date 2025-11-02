import type { Metadata } from "next";
import "./globals.css";
import "../styles/theme.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { cssVariableSheet } from "@easymo/ui/tokens";
import { isUiKitEnabled } from "@/lib/ui-kit";

export const metadata: Metadata = {
  title: "easyMO Admin Panel",
  description:
    "Operations console for platform staff — dashboards, vouchers, campaigns, and support tools.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const uiKitEnabled = isUiKitEnabled();
  return (
    <html lang="en">
      <body>
        {uiKitEnabled ? (
          <style
            data-testid="ui-kit-token-sheet"
            dangerouslySetInnerHTML={{ __html: cssVariableSheet }}
          />
        ) : null}
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
