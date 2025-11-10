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
import { useAdminSession } from "@/components/providers/SessionProvider";

interface PanelShellProps {
  children: ReactNode;
  environmentLabel: string;
  assistantEnabled: boolean;
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

export function PanelShell({ children, environmentLabel, assistantEnabled }: PanelShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, status, signOut } = useAdminSession();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const actorDisplayLabel = session
    ? session.label?.trim() || `${session.actorId.slice(0, 8)}…`
    : "";
  const [avatarInitials, setAvatarInitials] = useState(() =>
    deriveInitials(actorDisplayLabel || null, session?.actorId ?? "operator"),
  );

  useEffect(() => {
    if (!session) return;
    setAvatarInitials(deriveInitials(actorDisplayLabel, session.actorId));
  }, [actorDisplayLabel, session]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
    } catch (error) {
      console.error("panel.logout_failed", error);
    } finally {
      setSigningOut(false);
      await signOut();
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (!session) {
    return null;
  }

  return (
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
            <main id="main-content" className="layout__content" aria-live="polite">
              {children}
            </main>
          </div>
        </div>
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        {assistantEnabled && (
          <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
        )}
      </GradientBackground>
    </ToastProvider>
  );
}
