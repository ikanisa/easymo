"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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
import { useAdminSession } from "@/components/providers/SessionProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { PanelBreadcrumbs } from "@/components/layout/PanelBreadcrumbs";
import { CommandPalette } from "@/components/omnisearch/CommandPalette";
import { AgentSidecar } from "@/components/layout/AgentSidecar";
import {
  PanelContextProvider,
  type SidecarTab,
  type SidecarState,
} from "@/components/layout/PanelContext";
import type { OmniSearchResult, OmniSearchCategory } from "@/lib/omnisearch/types";
import { useFeatureFlag } from "@/lib/flags";

interface PanelShellProps {
  children: ReactNode;
  environmentLabel: string;
  assistantEnabled: boolean;
}

const CATEGORY_ALLOWED_TABS: Record<OmniSearchCategory, SidecarTab[]> = {
  agent: ["overview", "logs", "tasks", "policies"],
  request: ["logs", "tasks"],
  policy: ["policies"],
  task: ["tasks"],
};

function defaultTabForResult(result: OmniSearchResult): SidecarTab {
  switch (result.category) {
    case "agent":
      return "overview";
    case "request":
      return "logs";
    case "policy":
      return "policies";
    case "task":
      return "tasks";
    default:
      return "overview";
  }
}

function ensureAllowedTab(result: OmniSearchResult, desired: SidecarTab): SidecarTab {
  const allowed = CATEGORY_ALLOWED_TABS[result.category] ?? [defaultTabForResult(result)];
  return allowed.includes(desired) ? desired : allowed[0];
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidecarState, setSidecarState] = useState<SidecarState>({
    open: false,
    tab: "overview",
    entity: null,
  });
  const adminHubV2Enabled = useFeatureFlag("adminHubV2");

  const layoutClassName = classNames("layout", {
    "layout--rail": adminHubV2Enabled,
  });

  const omniSearchPlaceholder = adminHubV2Enabled
    ? "Search the admin hub — type '/' to launch Omnisearch"
    : undefined;

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
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  const openSidecar = useCallback((entity: OmniSearchResult, tabOverride?: SidecarTab) => {
    const initialTab = ensureAllowedTab(entity, tabOverride ?? defaultTabForResult(entity));
    setSidecarState({ open: true, entity, tab: initialTab });
  }, []);

  const closeSidecar = useCallback(() => {
    setSidecarState((prev) => ({ ...prev, open: false }));
  }, []);

  const setSidecarTab = useCallback((nextTab: SidecarTab) => {
    setSidecarState((prev) => {
      if (!prev.entity) return prev;
      const tabValue = ensureAllowedTab(prev.entity, nextTab);
      return { ...prev, tab: tabValue, open: true };
    });
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (event.altKey && !meta && !event.shiftKey) {
        if (event.key === "1") {
          event.preventDefault();
          setSidecarTab("logs");
        } else if (event.key === "2") {
          event.preventDefault();
          setSidecarTab("tasks");
        } else if (event.key === "3") {
          event.preventDefault();
          setSidecarTab("policies");
        } else if (event.key === "0") {
          event.preventDefault();
          closeSidecar();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSidecar, setSidecarTab]);

  const panelContextValue = useMemo(
    () => ({
      commandPaletteOpen,
      openCommandPalette,
      closeCommandPalette,
      openSidecar,
      closeSidecar,
      sidecarState,
      setSidecarTab,
    }),
    [
      closeCommandPalette,
      closeSidecar,
      commandPaletteOpen,
      openCommandPalette,
      openSidecar,
      sidecarState,
      setSidecarTab,
    ],
  );

  const handlePaletteSelect = useCallback(
    (result: OmniSearchResult) => {
      openSidecar(result);
      setCommandPaletteOpen(false);
    },
    [openSidecar],
  );

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
    <SessionProvider session={session}>
      <PanelContextProvider value={panelContextValue}>
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
                  onOpenAssistant={
                    assistantEnabled ? () => setAssistantOpen(true) : undefined
                  }
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
            <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
            {assistantEnabled && (
              <AssistantPanel
                open={assistantOpen}
                onClose={() => setAssistantOpen(false)}
              />
            )}
          </GradientBackground>
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            onSelect={handlePaletteSelect}
          />
          <AgentSidecar
            open={sidecarState.open}
            entity={sidecarState.entity}
            tab={sidecarState.tab}
            onClose={closeSidecar}
            onTabChange={setSidecarTab}
          />
        </ToastProvider>
      </PanelContextProvider>
    </SessionProvider>
  );
}
