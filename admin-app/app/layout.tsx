import type { Metadata } from "next";
import "./globals.css";
import "../styles/theme.css";
import { AppProviders } from "@/components/providers/AppProviders";

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
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
