"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import classNames from "classnames";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { TopBar } from "@/components/layout/TopBar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerToast } from "@/components/system/ServiceWorkerToast";
import { ServiceWorkerToasts } from "@/components/system/ServiceWorkerToasts";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { MobileNav } from "@/components/layout/MobileNav";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { PanelBreadcrumbs } from "@/components/layout/PanelBreadcrumbs";
import { useFeatureFlag } from "@/lib/flags";

interface PanelShellProps {
  children: ReactNode;
  environmentLabel: string;
  assistantEnabled: boolean;
  session: {
    actorId: string;
    label: string | null;
  };
}

function deriveInitials(label: string | null, actorId: string): string {
  const source = label?.trim() || actorId;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OP";
  if (parts.length === 1) {
    const value = parts[0];
    return value.slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PanelShell({
  children,
  environmentLabel,
  assistantEnabled,
  session,
}: PanelShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const actorDisplayLabel = session.label?.trim() || `${session.actorId.slice(0, 8)}…`;
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarInitials, setAvatarInitials] = useState(() =>
    deriveInitials(actorDisplayLabel, session.actorId),
  );
  const adminHubV2Enabled = useFeatureFlag("adminHubV2");

  const layoutClassName = classNames("layout", {
    "layout--rail": adminHubV2Enabled,
  });

  const omniSearchPlaceholder = adminHubV2Enabled
    ? "Search the admin hub — type '/' to launch Omnisearch"
    : undefined;

  useEffect(() => {
    setAvatarInitials(deriveInitials(actorDisplayLabel, session.actorId));
  }, [actorDisplayLabel, session.actorId]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("panel.logout_failed", error);
    } finally {
      setSigningOut(false);
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <SessionProvider session={session}>
      <ToastProvider>
        <ServiceWorkerToast />
        <ServiceWorkerToasts />
        <OfflineBanner />
        <GradientBackground variant="surface" className="min-h-screen">
          <div className={layoutClassName}>
            {adminHubV2Enabled ? <SidebarRail /> : <SidebarNav />}
            <div className="layout__main">
              <TopBar
                environmentLabel={environmentLabel}
                onOpenNavigation={() => setMobileNavOpen(true)}
                assistantEnabled={assistantEnabled}
                onOpenAssistant={assistantEnabled
                  ? () => setAssistantOpen(true)
                  : undefined}
                actorLabel={actorDisplayLabel}
                actorInitials={avatarInitials}
                onSignOut={handleSignOut}
                signingOut={signingOut}
                omniSearchPlaceholder={omniSearchPlaceholder}
                omniShortcutHint={adminHubV2Enabled ? "/" : undefined}
              />
              <main
                id="main-content"
                className="layout__content"
                aria-live="polite"
              >
                <PanelBreadcrumbs />
                {children}
              </main>
            </div>
          </div>
          <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
          {assistantEnabled && (
            <AssistantPanel
              open={assistantOpen}
              onClose={() => setAssistantOpen(false)}
            />
          )}
        </GradientBackground>
      </ToastProvider>
    </SessionProvider>
  );
}
