"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerToast } from "@/components/system/ServiceWorkerToast";
import { ServiceWorkerToasts } from "@/components/system/ServiceWorkerToasts";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { SessionProvider, type AdminSession } from "@/components/providers/SessionProvider";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { PanelContextProvider, type SidecarState } from "@/components/layout/PanelContext";

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
  const [signingOut, setSigningOut] = useState(false);
  const [avatarInitials, setAvatarInitials] = useState(() =>
    deriveInitials(actorDisplayLabel, session.actorId),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [sidecarState, setSidecarState] = useState<SidecarState>({
    open: false,
    tab: "overview",
    entity: null,
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const panelContextValue = useMemo(
    () => ({
      commandPaletteOpen,
      openCommandPalette: () => setCommandPaletteOpen(true),
      closeCommandPalette: () => setCommandPaletteOpen(false),
      openSidecar: (entity, tab = "overview") => setSidecarState({ open: true, entity, tab }),
      closeSidecar: () => setSidecarState((prev) => ({ ...prev, open: false })),
      sidecarState,
      setSidecarTab: (tab) => setSidecarState((prev) => ({ ...prev, tab })),
    }),
    [commandPaletteOpen, sidecarState],
  );

  return (
    <SessionProvider initialSession={session}>
      <ToastProvider>
        <ServiceWorkerToast />
        <ServiceWorkerToasts />
        <OfflineBanner />
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <PanelContextProvider value={panelContextValue}>
          <div className="app-shell">
            <SidebarRail />
            <div className="app-shell__workspace" ref={workspaceRef}>
              <TopBar
                environmentLabel={environmentLabel}
                onOpenNavigation={() => setMobileNavOpen(true)}
                assistantEnabled={assistantEnabled}
                onOpenAssistant={assistantEnabled ? () => setAssistantOpen(true) : undefined}
                actorLabel={actorDisplayLabel}
                actorInitials={avatarInitials}
                onSignOut={handleSignOut}
                signingOut={signingOut}
                menuButtonRef={menuButtonRef}
              />
              <main id="main-content" className="app-shell__content" aria-live="polite" tabIndex={-1}>
                <div className="panel-page__container">{children}</div>
              </main>
            </div>
          </div>
          <MobileNav open={mobileNavOpen} onClose={closeMobileNav} />
          {assistantEnabled && (
            <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
          )}
        </PanelContextProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
