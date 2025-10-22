"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { TopBar } from "@/components/layout/TopBar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerToast } from "@/components/system/ServiceWorkerToast";
import { ServiceWorkerToasts } from "@/components/system/ServiceWorkerToasts";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { MobileNav } from "@/components/layout/MobileNav";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { getAdminApiPath, getAdminRoutePath } from "@/lib/routes";

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

  useEffect(() => {
    setAvatarInitials(deriveInitials(actorDisplayLabel, session.actorId));
  }, [actorDisplayLabel, session.actorId]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await fetch(getAdminApiPath("auth", "logout"), {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("panel.logout_failed", error);
    } finally {
      setSigningOut(false);
      router.replace(getAdminRoutePath("login"));
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
          <div className="layout">
            <SidebarNav />
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
              />
              <main
                id="main-content"
                className="layout__content"
                aria-live="polite"
              >
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
