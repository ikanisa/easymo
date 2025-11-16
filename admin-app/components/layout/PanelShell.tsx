"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import { useSupabaseAuth } from "@/components/providers/SupabaseAuthProvider";

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
  const { signOut: supabaseSignOut } = useSupabaseAuth();
  const actorDisplayLabel = session.label?.trim() || `${session.actorId.slice(0, 8)}…`;
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarInitials, setAvatarInitials] = useState(() =>
    deriveInitials(actorDisplayLabel, session.actorId),
  );
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const firstNavLinkRef = useRef<HTMLAnchorElement | null>(null);
  const wasMobileNavOpen = useRef(false);

  useEffect(() => {
    setAvatarInitials(deriveInitials(actorDisplayLabel, session.actorId));
  }, [actorDisplayLabel, session.actorId]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabaseSignOut();
    } catch (error) {
      console.error("panel.logout_failed", error);
    } finally {
      setSigningOut(false);
      router.replace("/login");
      router.refresh();
    }
  };

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  useEffect(() => {
    const workspace = workspaceRef.current;
    const previousOverflow = document.body.style.overflow;

    if (mobileNavOpen) {
      workspace?.setAttribute("aria-hidden", "true");
      workspace?.setAttribute("inert", "");
      document.body.style.overflow = "hidden";
    } else {
      workspace?.removeAttribute("aria-hidden");
      workspace?.removeAttribute("inert");
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      workspace?.removeAttribute("aria-hidden");
      workspace?.removeAttribute("inert");
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const drawerElement = drawerRef.current;
    if (!drawerElement) return;

    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const getFocusableElements = () =>
      Array.from(
        drawerElement.querySelectorAll<HTMLElement>(focusableSelectors),
      ).filter((element) =>
        !element.hasAttribute("disabled") &&
        !element.getAttribute("aria-hidden"),
      );

    const focusFirstItem = () => {
      const primaryLink = firstNavLinkRef.current;
      if (primaryLink) {
        primaryLink.focus();
        return;
      }
      const focusable = getFocusableElements();
      (focusable[0] ?? drawerElement).focus();
    };

    const timer = window.setTimeout(focusFirstItem, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNav();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        drawerElement.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === first || !drawerElement.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    drawerElement.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      drawerElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileNav, mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen && wasMobileNavOpen.current) {
      menuButtonRef.current?.focus();
    }
    wasMobileNavOpen.current = mobileNavOpen;
  }, [mobileNavOpen]);

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
          <div className="bing-shell__workspace" ref={workspaceRef}>
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
              menuButtonRef={menuButtonRef}
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
          <div
            className="bing-nav-drawer"
            role="presentation"
            onClick={closeMobileNav}
          >
            <div
              className="bing-nav-drawer__panel"
              role="dialog"
              aria-modal="true"
              aria-label="Primary navigation"
              ref={drawerRef}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
              <BingNav
                mode="overlay"
                onClose={closeMobileNav}
                firstLinkRef={firstNavLinkRef}
              />
            </div>
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
