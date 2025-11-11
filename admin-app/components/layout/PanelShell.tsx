"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BingNav } from "@/components/layout/BingNav";
import { BingHeader } from "@/components/layout/BingHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerToast } from "@/components/system/ServiceWorkerToast";
import { ServiceWorkerToasts } from "@/components/system/ServiceWorkerToasts";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import {
  SessionProvider,
  type AdminSession,
} from "@/components/providers/SessionProvider";

interface PanelShellProps {
  children: ReactNode;
  environmentLabel: string;
  assistantEnabled: boolean;
  session: AdminSession;
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
    <SessionProvider initialSession={session}>
      <ToastProvider>
        <ServiceWorkerToast />
        <ServiceWorkerToasts />
        <OfflineBanner />
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="bing-shell">
          <BingNav />
          <div className="bing-shell__workspace">
            <BingHeader
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
              className="bing-shell__content"
              aria-live="polite"
              tabIndex={-1}
            >
              <div className="panel-page__container">{children}</div>
            </main>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="bing-nav-drawer" role="dialog" aria-modal="true">
            <BingNav mode="overlay" onClose={() => setMobileNavOpen(false)} />
          </div>
        )}
        {assistantEnabled && (
          <AssistantPanel
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
          />
        )}
      </ToastProvider>
    </SessionProvider>
  );
}
