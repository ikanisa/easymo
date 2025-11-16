"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerToast } from "@/components/system/ServiceWorkerToast";
import { ServiceWorkerToasts } from "@/components/system/ServiceWorkerToasts";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
// Securely determine DEFAULT_ACTOR_ID: require explicit env in production
const _adminActorId =
  process.env.NEXT_PUBLIC_ADMIN_ACTOR_ID ||
  process.env.ADMIN_TEST_ACTOR_ID;
let DEFAULT_ACTOR_ID: string;
if (_adminActorId) {
  DEFAULT_ACTOR_ID = _adminActorId;
} else if (process.env.NODE_ENV === "production") {
  throw new Error(
    "SECURITY: No admin actor ID set. Set NEXT_PUBLIC_ADMIN_ACTOR_ID or ADMIN_TEST_ACTOR_ID in production."
  );
} else {
  // Allow fallback only in non-production (dev/test)
  DEFAULT_ACTOR_ID = "00000000-0000-0000-0000-000000000001";
}
const DEFAULT_ACTOR_LABEL =
  process.env.NEXT_PUBLIC_ADMIN_ACTOR_LABEL || "Operator";
import { SessionProvider, type AdminSession } from "@/components/providers/SessionProvider";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { PanelContextProvider, type SidecarState } from "@/components/layout/PanelContext";

interface PanelShellProps {
  children: ReactNode;
  environmentLabel: string;
  assistantEnabled: boolean;
  actorId?: string;
  actorLabel?: string | null;
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
  actorId = DEFAULT_ACTOR_ID,
  actorLabel = DEFAULT_ACTOR_LABEL,
}: PanelShellProps) {
  const router = useRouter();
  const actorDisplayLabel = actorLabel?.trim() || `${actorId.slice(0, 8)}…`;
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarInitials, setAvatarInitials] = useState(() =>
    deriveInitials(actorDisplayLabel, actorId),
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
    if (typeof window === "undefined" || !actorId) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request =
        input instanceof Request
          ? input
          : new Request(input, init ?? { credentials: "same-origin" });

      try {
        const url = new URL(request.url, window.location.origin);
        if (url.origin === window.location.origin) {
          const headers = new Headers(request.headers);
          if (!headers.has("x-actor-id")) {
            headers.set("x-actor-id", actorId);
          }
          return originalFetch(
            new Request(request, {
              headers,
              credentials: request.credentials,
            }),
          );
        }
      } catch (error) {
        console.warn("panel.fetch_enrichment_failed", error);
      }

      return originalFetch(request);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [actorId]);

  useEffect(() => {
    setAvatarInitials(deriveInitials(actorDisplayLabel, actorId));
  }, [actorDisplayLabel, actorId]);

  const handleSignOut = async () => {
    setSigningOut(true);
    router.replace("/");
    router.refresh();
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
